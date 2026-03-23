/**
 * Storm-to-rep pipeline orchestrator
 * Chains: alert/territory → re-score leads → briefing → mission pack
 */

import { createClient } from "@supabase/supabase-js";
import { calculateLeadScore, calculateBatchLeadScores } from "@/lib/lead-scoring";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type PipelineTrigger = "storm_alert" | "territory_update" | "manual";

export interface PipelineInput {
	triggerType: PipelineTrigger;
	triggerId?: string;
	userId: string;
	teamId?: string | null;
	centerLat?: number;
	centerLng?: number;
	radiusMiles?: number;
	territoryId?: string;
	stormAlertId?: string;
	idempotencyKey?: string;
}

export interface MissionPackContent {
	title: string;
	briefingText: string;
	objectionSnippets: Array<{ objection: string; response: string }>;
	carrierNotes: Array<{ carrier: string; tactics: string }>;
	territorySummary: string;
	topLeadsPreview: Array<{ address: string; score: number; estimatedClaim?: number }>;
	totalOpportunityValue: number;
	recommendedAction: "deploy" | "hold" | "monitor";
}

export interface PipelineResult {
	success: boolean;
	runId: string;
	missionPackId?: string;
	leadsRescored: number;
	briefing?: string;
	error?: string;
}

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function runStormPipeline(input: PipelineInput): Promise<PipelineResult> {
	const runId = crypto.randomUUID();
	let leadsRescored = 0;
	let briefingText: string | null = null;
	let missionPackId: string | null = null;

	try {
		// 1. Create pipeline run record
		const { data: run, error: runError } = await supabaseAdmin
			.from("storm_pipeline_runs")
			.insert({
				id: runId,
				trigger_type: input.triggerType,
				trigger_id: input.triggerId ?? null,
				user_id: input.userId,
				team_id: input.teamId ?? null,
				center_lat: input.centerLat ?? null,
				center_lng: input.centerLng ?? null,
				radius_miles: input.radiusMiles ?? 5,
				status: "running",
				idempotency_key: input.idempotencyKey ?? null,
			})
			.select("id")
			.single();

		if (runError && !input.idempotencyKey) {
			return {
				success: false,
				runId,
				leadsRescored: 0,
				error: runError.message,
			};
		}

		// 2. Fetch leads in scope (territory or radius around center)
		let leads: Array<{
			id: string;
			address: string;
			city: string | null;
			state: string | null;
			zip: string | null;
			latitude: number;
			longitude: number;
			lead_score: number;
			estimated_claim: number | null;
			year_built: number | null;
			square_feet: number | null;
			assessed_value: number | null;
		}> = [];

		if (input.territoryId) {
			const { data: territoryLeads } = await supabaseAdmin
				.from("leads")
				.select(
					"id, address, city, state, zip, latitude, longitude, lead_score, estimated_claim, year_built, square_feet, assessed_value"
				)
				.eq("territory_id", input.territoryId)
				.not("latitude", "is", null)
				.not("longitude", "is", null)
				.limit(100);
			leads = territoryLeads ?? [];
		} else if (input.centerLat != null && input.centerLng != null) {
			const radius = (input.radiusMiles ?? 5) / 69; // rough deg lat
			const { data: radiusLeads } = await supabaseAdmin
				.from("leads")
				.select(
					"id, address, city, state, zip, latitude, longitude, lead_score, estimated_claim, year_built, square_feet, assessed_value"
				)
				.eq("user_id", input.userId)
				.gte("latitude", input.centerLat - radius)
				.lte("latitude", input.centerLat + radius)
				.gte("longitude", input.centerLng - radius)
				.lte("longitude", input.centerLng + radius)
				.limit(100);
			leads = radiusLeads ?? [];
		}

		// 3. Re-score leads
		if (leads.length > 0) {
			const scoreMap = await calculateBatchLeadScores(
				leads.map((l) => ({
					id: l.id,
					latitude: l.latitude,
					longitude: l.longitude,
					yearBuilt: l.year_built ?? undefined,
					squareFeet: l.square_feet ?? undefined,
					assessedValue: l.assessed_value ?? undefined,
				}))
			);

			for (const lead of leads) {
				const result = scoreMap.get(lead.id);
				if (result && result.totalScore !== lead.lead_score) {
					await supabaseAdmin
						.from("leads")
						.update({
							lead_score: Math.round(result.totalScore),
							storm_proximity_score: Math.round(result.stormProximityScore),
							roof_age_score: Math.round(result.roofAgeScore),
							roof_size_score: Math.round(result.roofSizeScore),
							property_value_score: Math.round(result.propertyValueScore),
							hail_history_score: Math.round(result.hailHistoryScore),
							updated_at: new Date().toISOString(),
						})
						.eq("id", lead.id);
					leadsRescored++;
				}
			}
		}

		// 4. Build top leads preview (re-sort by new scores if we rescored, else use existing)
		const topLeads = leads
			.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
			.slice(0, 10)
			.map((l) => ({
				address: [l.address, l.city, l.state].filter(Boolean).join(", ") || l.address,
				score: l.lead_score ?? 0,
				estimatedClaim: l.estimated_claim ?? undefined,
			}));

		const totalOpportunity = leads.reduce((s, l) => s + (l.estimated_claim ?? 0), 0);

		// 5. Generate briefing via AI
		if (process.env.OPENAI_API_KEY) {
			const locationName =
				input.territoryId ? `Territory` : `${input.centerLat?.toFixed(2)}, ${input.centerLng?.toFixed(2)}`;
			briefingText = await generateBriefing({
				triggerType: input.triggerType,
				leadsCount: leads.length,
				leadsRescored,
				topLeads,
				totalOpportunity,
				locationName,
			});
		} else {
			briefingText = `Territory briefing: ${leads.length} leads in scope, ${leadsRescored} rescored. Total opportunity: $${totalOpportunity.toLocaleString()}.`;
		}

		// 6. Generate objection snippets and carrier notes (lightweight)
		const objectionSnippets = await generateObjectionSnippets();
		const carrierNotes = await generateCarrierNotes();

		// 7. Determine recommended action
		const recommendedAction: "deploy" | "hold" | "monitor" =
			topLeads.length > 0 && (topLeads[0]?.score ?? 0) >= 70
				? "deploy"
				: topLeads.length > 0 && (topLeads[0]?.score ?? 0) >= 45
					? "monitor"
					: "hold";

		// 8. Create mission pack
		const { data: pack, error: packError } = await supabaseAdmin
			.from("mission_packs")
			.insert({
				user_id: input.userId,
				team_id: input.teamId ?? null,
				pipeline_run_id: runId,
				storm_alert_id: input.stormAlertId ?? null,
				territory_id: input.territoryId ?? null,
				title: `Mission Pack — ${new Date().toLocaleDateString()} ${input.territoryId ? "(Territory)" : "(Radius)"}`,
				briefing_text: briefingText,
				objection_snippets: objectionSnippets,
				carrier_notes: carrierNotes,
				territory_summary: ` ${leads.length} leads in scope. ${leadsRescored} rescored. Total estimated opportunity: $${totalOpportunity.toLocaleString()}.`,
				top_leads_preview: topLeads,
				total_opportunity_value: totalOpportunity,
				recommended_action: recommendedAction,
				center_lat: input.centerLat ?? null,
				center_lng: input.centerLng ?? null,
				location_name: input.territoryId ? "Territory" : "Custom radius",
			})
			.select("id")
			.single();

		if (!packError && pack) {
			missionPackId = pack.id;
			await supabaseAdmin
				.from("storm_pipeline_runs")
				.update({
					status: "completed",
					leads_rescored: leadsRescored,
					briefing_text: briefingText,
					mission_pack_id: missionPackId,
					completed_at: new Date().toISOString(),
				})
				.eq("id", runId);
		} else {
			await supabaseAdmin
				.from("storm_pipeline_runs")
				.update({
					status: "partial",
					leads_rescored: leadsRescored,
					briefing_text: briefingText,
					error_message: packError?.message ?? null,
					completed_at: new Date().toISOString(),
				})
				.eq("id", runId);
		}

		return {
			success: !packError,
			runId,
			missionPackId: missionPackId ?? undefined,
			leadsRescored,
			briefing: briefingText ?? undefined,
		};
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		await supabaseAdmin
			.from("storm_pipeline_runs")
			.update({
				status: "failed",
				error_message: errMsg,
				leads_rescored: leadsRescored,
				completed_at: new Date().toISOString(),
			})
			.eq("id", runId);

		return {
			success: false,
			runId,
			leadsRescored,
			error: errMsg,
		};
	}
}

async function generateBriefing(ctx: {
	triggerType: PipelineTrigger;
	leadsCount: number;
	leadsRescored: number;
	topLeads: Array<{ address: string; score: number; estimatedClaim?: number }>;
	totalOpportunity: number;
	locationName: string;
}): Promise<string> {
	const completion = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [
			{
				role: "system",
				content: `You are a storm damage sales operations AI. Generate a 2-3 paragraph tactical briefing for door-knocking reps. Be direct, data-driven, use numbers. Format with brief sections.`,
			},
			{
				role: "user",
				content: `Brief for ${ctx.locationName}:
- ${ctx.leadsCount} leads in scope, ${ctx.leadsRescored} rescored
- Top addresses: ${ctx.topLeads.slice(0, 5).map((l) => `${l.address} (score ${l.score})`).join("; ")}
- Total opportunity: $${ctx.totalOpportunity.toLocaleString()}

Give deployment recommendation (deploy/monitor/hold), top 3 action items, and a one-line motivation. Keep under 150 words.`,
			},
		],
		max_tokens: 400,
	});

	return completion.choices[0]?.message?.content?.trim() ?? "Briefing unavailable.";
}

async function generateObjectionSnippets(): Promise<Array<{ objection: string; response: string }>> {
	// Default snippets; can be replaced with AI or carrier-specific later
	return [
		{
			objection: "I need to think about it",
			response: "Totally understand. With storm damage, timing matters — most policies have filing windows. Want me to leave a card with our contact info?",
		},
		{
			objection: "I already have a contractor",
			response: "No problem. If anything changes or you want a second opinion on your claim, we’re here. Mind if I leave our card?",
		},
		{
			objection: "My deductible is too high",
			response: "We can walk through your policy together. Sometimes there are endorsements or adjustments. Would a free inspection help clarify what might be covered?",
		},
	];
}

async function generateCarrierNotes(): Promise<Array<{ carrier: string; tactics: string }>> {
	return [
		{ carrier: "State Farm", tactics: "Document everything. Photos, notes, dates. They often request reinspection." },
		{ carrier: "Allstate", tactics: "Be prepared for desk review. Supplement with line-item detail and RCV vs ACV clarity." },
		{ carrier: "Farmers", tactics: "Claim reps rotate. Get adjuster name and follow up in writing." },
		{ carrier: "Liberty Mutual", tactics: "Strong on documentation. Include manufacturer specs for materials when possible." },
	];
}
