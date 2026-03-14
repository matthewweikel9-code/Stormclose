// ── AI Context Builder ───────────────────────────────────────────────────────
// Assembles AiContext from identifiers. Server-side only.
// The client sends IDs; this utility fetches and shapes the full context.

import { missionsService } from "@/services/missions/missionService";
import type {
	AiContext,
	AiCompanyProfile,
	AiStormContext,
	AiHouseContext,
	AiMissionContext,
	AiRepContext,
	AiTonePreference,
	AiOutputFormat,
} from "@/types/ai-context";

// ── Default company profile (used until company_ai_profiles table exists) ───

export function getDefaultCompanyProfile(): AiCompanyProfile {
	return {
		companyName: "Stormclose Roofing",
		serviceArea: ["Dallas-Fort Worth", "North Texas"],
		certifications: ["GAF Master Elite", "Haag Certified Inspector"],
		yearsInBusiness: 12,
		warrantyDescription: "50-year manufacturer warranty + 10-year workmanship warranty",
		carrierExperience: ["State Farm", "Allstate", "USAA", "Farmers", "Liberty Mutual"],
		financingAvailable: true,
		valuePropositions: [
			"Insurance claim documentation at no extra charge",
			"GAF Master Elite contractor (top 2% nationwide)",
			"Full Xactimate-coded estimates",
			"No payment until claim is approved",
			"10-year workmanship warranty",
		],
	};
}

// ── Default tone ─────────────────────────────────────────────────────────────

export function getDefaultTonePreference(): AiTonePreference {
	return {
		voice: "professional",
		customSystemPromptSuffix: null,
		lengthPreference: "standard",
		includeInsuranceLanguage: true,
		includeFinancingLanguage: true,
		bannedPhrases: [],
	};
}

// ── Build mission context from mission ID ────────────────────────────────────

export async function buildMissionContext(
	userId: string,
	missionId: string,
): Promise<AiMissionContext | null> {
	try {
		const detail = await missionsService.getMissionDetail(userId, missionId);
		if (!detail) return null;

		const { mission, stops } = detail;
		const completed = stops.filter((s) =>
			["interested", "not_interested", "no_answer", "sent_to_jobnimbus"].includes(s.status),
		);
		const interested = stops.filter((s) => s.status === "interested");
		const noAnswer = stops.filter((s) => s.status === "no_answer");
		const notInterested = stops.filter((s) => s.status === "not_interested");
		const remaining = stops.length - completed.length;
		const pct = stops.length > 0 ? Math.round((completed.length / stops.length) * 100) : 0;

		let durationMinutes: number | null = null;
		if (mission.startedAt) {
			const end = mission.completedAt ? new Date(mission.completedAt) : new Date();
			durationMinutes = Math.round(
				(end.getTime() - new Date(mission.startedAt).getTime()) / 60_000,
			);
		}

		return {
			missionId: mission.id,
			missionName: mission.name,
			status: mission.status,
			stormZoneName: null, // enriched when storm zones are implemented
			assignedRepName: null, // enriched when user lookup is implemented
			totalStops: stops.length,
			stopsCompleted: completed.length,
			stopsRemaining: remaining,
			completionPercent: pct,
			interestedCount: interested.length,
			noAnswerCount: noAnswer.length,
			notInterestedCount: notInterested.length,
			startedAt: mission.startedAt,
			durationMinutes,
		};
	} catch {
		return null;
	}
}

// ── Build house context from a mission stop ──────────────────────────────────

export function buildHouseContextFromStop(stop: {
	address: string;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	opportunityScore?: number;
	scoreTier?: string | null;
	stormSeverity?: string | null;
	status?: string;
	notes?: string | null;
}): AiHouseContext {
	return {
		address: stop.address,
		cityStateZip: [stop.city, stop.state, stop.zip].filter(Boolean).join(", "),
		opportunityScore: stop.opportunityScore ?? 0,
		scoreTier: (stop.scoreTier as AiHouseContext["scoreTier"]) ?? "moderate",
		stormSeverity: (stop.stormSeverity as AiHouseContext["stormSeverity"]) ?? "moderate",
		stormAgeDays: 0,
		estimatedValueBand: "Unknown",
		yearBuilt: null,
		roofAge: null,
		assessedValue: null,
		stopStatus: stop.status ?? null,
		priorAttempts: 0,
		homeownerName: null,
		repNotes: stop.notes ?? null,
	};
}

// ── Full context builder ─────────────────────────────────────────────────────

export interface BuildContextOptions {
	userId: string;
	missionId?: string | null;
	houseContext?: AiHouseContext | null;
	stormContext?: AiStormContext | null;
	repContext?: AiRepContext | null;
	companyProfile?: AiCompanyProfile | null;
	tonePreference?: AiTonePreference | null;
	outputFormat?: AiOutputFormat;
	userNotes?: string | null;
}

export async function buildContext(opts: BuildContextOptions): Promise<AiContext> {
	const companyProfile = opts.companyProfile ?? getDefaultCompanyProfile();
	const tonePreference = opts.tonePreference ?? getDefaultTonePreference();

	let missionContext: AiMissionContext | null = null;
	if (opts.missionId) {
		missionContext = await buildMissionContext(opts.userId, opts.missionId);
	}

	return {
		companyProfile,
		stormContext: opts.stormContext ?? null,
		houseContext: opts.houseContext ?? null,
		missionContext,
		repContext: opts.repContext ?? null,
		tonePreference,
		outputFormat: opts.outputFormat ?? "markdown",
		userNotes: opts.userNotes ?? null,
	};
}
