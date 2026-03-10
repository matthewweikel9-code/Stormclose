import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseAdmin = createAdminClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

interface Lead {
	id: string;
	address: string;
	city: string;
	state: string;
	zip: string;
	year_built?: number;
	square_feet?: number;
	assessed_value?: number;
	roof_age?: number;
	lead_score: number;
	storm_date?: string;
	hail_size?: number;
	status: string;
}

interface PropertyBriefing {
	summary: string;
	talking_points: string[];
	objection_handlers: { objection: string; response: string }[];
	neighborhood_context: string;
	score_breakdown: {
		storm_proximity: { score: number; reason: string };
		roof_age: { score: number; reason: string };
		property_value: { score: number; reason: string };
		hail_history: { score: number; reason: string };
	};
	urgency_level: "high" | "medium" | "low";
	best_approach: string;
}

// GET: Fetch briefing for a lead
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const leadId = searchParams.get("leadId");

	if (!leadId) {
		return NextResponse.json({ error: "leadId is required" }, { status: 400 });
	}

	try {
		// Check if we have a cached briefing
		const { data: cachedBriefing } = await supabaseAdmin
			.from("property_briefings")
			.select("*")
			.eq("lead_id", leadId)
			.gt("expires_at", new Date().toISOString())
			.single();

		if (cachedBriefing) {
			return NextResponse.json({
				success: true,
				briefing: cachedBriefing,
				cached: true,
			});
		}

		// Generate new briefing
		const { data: lead } = await supabaseAdmin
			.from("leads")
			.select("*")
			.eq("id", leadId)
			.single();

		if (!lead) {
			return NextResponse.json({ error: "Lead not found" }, { status: 404 });
		}

		// Get recent hail events near this property
		const { data: nearbyHail } = await supabaseAdmin
			.from("hail_events")
			.select("event_date, size_inches, location_name")
			.eq("state", lead.state)
			.gte("event_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
			.order("event_date", { ascending: false })
			.limit(5);

		const briefing = await generateBriefing(lead, nearbyHail || []);

		// Cache the briefing
		await supabaseAdmin.from("property_briefings").upsert({
			lead_id: leadId,
			summary: briefing.summary,
			talking_points: briefing.talking_points,
			objection_handlers: briefing.objection_handlers,
			neighborhood_context: briefing.neighborhood_context,
			score_breakdown: briefing.score_breakdown,
			model_used: "gpt-4o",
			generated_at: new Date().toISOString(),
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		});

		// Update lead
		await supabaseAdmin
			.from("leads")
			.update({
				ai_briefing_generated: true,
				last_ai_briefing_at: new Date().toISOString(),
			})
			.eq("id", leadId);

		return NextResponse.json({
			success: true,
			briefing,
			cached: false,
		});
	} catch (error) {
		console.error("Briefing error:", error);
		return NextResponse.json(
			{ error: "Failed to generate briefing" },
			{ status: 500 }
		);
	}
}

async function generateBriefing(
	lead: Lead,
	nearbyHail: any[]
): Promise<PropertyBriefing> {
	const currentYear = new Date().getFullYear();
	const roofAge = lead.roof_age || (lead.year_built ? currentYear - lead.year_built : null);
	
	const prompt = `You are an expert roofing sales coach. Generate a brief, actionable property briefing for a door-to-door salesperson about to knock on this door.

PROPERTY DATA:
- Address: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}
- Year Built: ${lead.year_built || "Unknown"}
- Roof Age: ${roofAge ? `~${roofAge} years` : "Unknown"}
- Square Feet: ${lead.square_feet || "Unknown"}
- Estimated Value: ${lead.assessed_value ? `$${lead.assessed_value.toLocaleString()}` : "Unknown"}
- Lead Score: ${lead.lead_score}/100
- Status: ${lead.status}
${lead.storm_date ? `- Recent Storm: ${lead.storm_date} (${lead.hail_size}" hail)` : ""}

RECENT HAIL ACTIVITY IN AREA:
${nearbyHail.length > 0 
	? nearbyHail.map(h => `- ${h.event_date}: ${h.size_inches}" hail in ${h.location_name}`).join("\n")
	: "No recent hail events recorded"
}

Generate a JSON response with:
1. "summary": A one-sentence hook/opener for the salesperson (what makes this property special)
2. "talking_points": Array of 3-4 key talking points to mention
3. "objection_handlers": Array of 2-3 common objections and responses
4. "neighborhood_context": Brief context about the area/neighborhood
5. "score_breakdown": Why this lead scored the way it did (storm_proximity, roof_age, property_value, hail_history - each with score 0-25 and reason)
6. "urgency_level": "high", "medium", or "low"
7. "best_approach": Suggested approach for this specific property

Be specific, actionable, and sales-focused. Assume the salesperson is professional and experienced.`;

	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{
					role: "system",
					content: "You are an expert roofing sales coach. Always respond with valid JSON only, no markdown or explanations.",
				},
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.7,
			max_tokens: 1000,
		});

		const content = completion.choices[0]?.message?.content;
		if (!content) {
			throw new Error("No response from OpenAI");
		}

		const parsed = JSON.parse(content);
		return {
			summary: parsed.summary || "Storm-affected property with high potential.",
			talking_points: parsed.talking_points || [],
			objection_handlers: parsed.objection_handlers || [],
			neighborhood_context: parsed.neighborhood_context || "",
			score_breakdown: parsed.score_breakdown || {
				storm_proximity: { score: 0, reason: "Unknown" },
				roof_age: { score: 0, reason: "Unknown" },
				property_value: { score: 0, reason: "Unknown" },
				hail_history: { score: 0, reason: "Unknown" },
			},
			urgency_level: parsed.urgency_level || "medium",
			best_approach: parsed.best_approach || "Standard approach",
		};
	} catch (error) {
		console.error("OpenAI error:", error);
		// Return a basic briefing if AI fails
		return {
			summary: `${roofAge ? `${roofAge}-year-old roof` : "Property"} in ${lead.city} - Lead score ${lead.lead_score}/100`,
			talking_points: [
				"Recent storm activity in the area",
				"Free no-obligation roof inspection",
				"Work directly with insurance",
			],
			objection_handlers: [
				{ objection: "I'm not interested", response: "I understand. We're just checking on homes in the area after the recent storms. Do you know if you had any hail damage?" },
				{ objection: "I already have a roofer", response: "That's great! We offer free second opinions and work directly with insurance. Many homeowners have more damage than they realize." },
			],
			neighborhood_context: `Located in ${lead.city}, ${lead.state}`,
			score_breakdown: {
				storm_proximity: { score: lead.storm_date ? 25 : 0, reason: lead.storm_date ? "Recent storm hit this area" : "No recent storms" },
				roof_age: { score: roofAge && roofAge > 15 ? 20 : 10, reason: roofAge ? `Roof is ~${roofAge} years old` : "Age unknown" },
				property_value: { score: 15, reason: "Standard value property" },
				hail_history: { score: 15, reason: "Area has hail history" },
			},
			urgency_level: lead.lead_score >= 70 ? "high" : lead.lead_score >= 50 ? "medium" : "low",
			best_approach: "Standard door knock approach - mention recent storm activity",
		};
	}
}

// POST: Generate briefing for a single lead (with data) or multiple leads (with leadIds)
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { lead_id, leadIds, address, city, state, zip, owner_name, year_built, sqft, estimated_profit, lead_score, estimated_roof_age } = body;

		// Handle single lead case (from Prep Me button)
		if (lead_id && address) {
			// Generate briefing directly from provided data (no DB lookup needed for ATTOM-sourced leads)
			const leadData: Lead = {
				id: lead_id,
				address: address,
				city: city || '',
				state: state || '',
				zip: zip || '',
				year_built: year_built,
				square_feet: sqft,
				assessed_value: undefined,
				roof_age: estimated_roof_age,
				lead_score: lead_score || 50,
				storm_date: undefined,
				hail_size: undefined,
				status: 'new'
			};

			// Try to get nearby hail events for context
			let nearbyHail: any[] = [];
			if (state) {
				const { data: hailData } = await supabaseAdmin
					.from("hail_events")
					.select("event_date, size_inches, location_name")
					.eq("state", state)
					.gte("event_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
					.order("event_date", { ascending: false })
					.limit(5);
				nearbyHail = hailData || [];
			}

			const briefing = await generateBriefing(leadData, nearbyHail);

			return NextResponse.json({
				success: true,
				briefing,
				cached: false,
			});
		}

		// Handle bulk case (legacy)
		if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
			return NextResponse.json({ error: "lead_id with address OR leadIds array is required" }, { status: 400 });
		}

		// Limit batch size
		const limitedIds = leadIds.slice(0, 10);
		const results: { leadId: string; success: boolean; error?: string }[] = [];

		for (const leadId of limitedIds) {
			try {
				const { data: lead } = await supabaseAdmin
					.from("leads")
					.select("*")
					.eq("id", leadId)
					.single();

				if (!lead) {
					results.push({ leadId, success: false, error: "Lead not found" });
					continue;
				}

				const briefing = await generateBriefing(lead, []);

				await supabaseAdmin.from("property_briefings").upsert({
					lead_id: leadId,
					summary: briefing.summary,
					talking_points: briefing.talking_points,
					objection_handlers: briefing.objection_handlers,
					neighborhood_context: briefing.neighborhood_context,
					score_breakdown: briefing.score_breakdown,
					model_used: "gpt-4o",
					generated_at: new Date().toISOString(),
					expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				});

				await supabaseAdmin
					.from("leads")
					.update({
						ai_briefing_generated: true,
						last_ai_briefing_at: new Date().toISOString(),
					})
					.eq("id", leadId);

				results.push({ leadId, success: true });
			} catch (error) {
				results.push({ leadId, success: false, error: String(error) });
			}
		}

		return NextResponse.json({
			success: true,
			results,
			processed: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
		});
	} catch (error) {
		console.error("Batch briefing error:", error);
		return NextResponse.json(
			{ error: "Failed to generate briefings" },
			{ status: 500 }
		);
	}
}
