// ── AI Studio Shared Context Contract ─────────────────────────────────────────
// Every AI module receives a subset of the AiContext object.
// Modules declare which keys they require vs. accept as optional.
// The API assembles the context server-side — the client sends identifiers only.

// ── Company Profile ──────────────────────────────────────────────────────────

export interface AiCompanyProfile {
	companyName: string;
	serviceArea: string[];
	certifications: string[];
	yearsInBusiness: number;
	warrantyDescription: string;
	carrierExperience: string[];
	financingAvailable: boolean;
	valuePropositions: string[];
}

// ── Storm Context ────────────────────────────────────────────────────────────

export interface AiStormContext {
	zoneId: string;
	zoneName: string;
	score: number;
	severity: "extreme" | "severe" | "moderate" | "minor";
	eventType: "hail" | "wind" | "tornado" | "mixed";
	maxHailSizeInches: number | null;
	maxWindSpeedMph: number | null;
	stormAgeDays: number;
	houseCount: number;
	unworkedHouseCount: number;
	activeMissionCount: number;
	centroidLat: number;
	centroidLng: number;
}

// ── House Context ────────────────────────────────────────────────────────────

export interface AiHouseContext {
	address: string;
	cityStateZip: string;
	opportunityScore: number;
	scoreTier: "hot" | "warm" | "moderate" | "cold";
	stormSeverity: "extreme" | "severe" | "moderate" | "minor";
	stormAgeDays: number;
	estimatedValueBand: "$5k–$10k" | "$10k–$20k" | "$20k–$40k" | "$40k+" | "Unknown";
	yearBuilt: number | null;
	roofAge: number | null;
	assessedValue: number | null;
	stopStatus: string | null;
	priorAttempts: number;
	homeownerName: string | null;
	repNotes: string | null;
}

// ── Mission Context ──────────────────────────────────────────────────────────

export interface AiMissionContext {
	missionId: string;
	missionName: string;
	status: "planned" | "active" | "paused" | "completed" | "expired";
	stormZoneName: string | null;
	assignedRepName: string | null;
	totalStops: number;
	stopsCompleted: number;
	stopsRemaining: number;
	completionPercent: number;
	interestedCount: number;
	noAnswerCount: number;
	notInterestedCount: number;
	startedAt: string | null;
	durationMinutes: number | null;
}

// ── Rep Context ──────────────────────────────────────────────────────────────

export interface AiRepContext {
	userId: string;
	name: string;
	fieldStatus: "active" | "idle" | "driving" | "at_door" | "offline" | "paused";
	doorsTodayCount: number;
	appointmentsTodayCount: number;
	interestedTodayCount: number;
	noAnswerRate: number;
	avgDoorsPerHour: number;
	recentOutcomes: string[];
	activeMissionName: string | null;
	daysActive: number;
	lifetimeDoorsKnocked: number;
	lifetimeAppointmentsSet: number;
}

// ── Tone Preference ──────────────────────────────────────────────────────────

export type AiVoice = "professional" | "friendly" | "consultative" | "confident" | "empathetic" | "urgent";

export interface AiTonePreference {
	voice: AiVoice;
	customSystemPromptSuffix: string | null;
	lengthPreference: "concise" | "standard" | "detailed";
	includeInsuranceLanguage: boolean;
	includeFinancingLanguage: boolean;
	bannedPhrases: string[];
}

// ── Output Format ────────────────────────────────────────────────────────────

export type AiOutputFormat = "text" | "markdown" | "html" | "json" | "pdf_draft";

// ── Module IDs ───────────────────────────────────────────────────────────────

export type AiModuleId =
	| "daily-brief"
	| "mission-copilot"
	| "opportunity-summary"
	| "objection-response"
	| "negotiation-coach"
	| "follow-up-writer"
	| "export-summary"
	| "rep-coaching"
	| "zone-summary"
	| "company-voice";

// ── Master Context ───────────────────────────────────────────────────────────

/**
 * The master context object assembled server-side.
 * Each AI module declares which keys it requires vs. optional.
 * Null = not applicable for this module call.
 */
export interface AiContext {
	companyProfile: AiCompanyProfile;
	stormContext: AiStormContext | null;
	houseContext: AiHouseContext | null;
	missionContext: AiMissionContext | null;
	repContext: AiRepContext | null;
	tonePreference: AiTonePreference;
	outputFormat: AiOutputFormat;
	userNotes: string | null;
}

// ── AI Session Log ───────────────────────────────────────────────────────────

export interface AiSessionLog {
	moduleId: AiModuleId;
	model: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	estimatedCostUsd: number;
	latencyMs: number;
}

// ── Module Card (hub page) ───────────────────────────────────────────────────

export interface AiModuleCard {
	id: AiModuleId;
	label: string;
	description: string;
	icon: string;
	route: string;
	allowedRoles: Array<"owner" | "manager" | "rep" | "office_admin">;
	category: "operations" | "field" | "communication" | "admin";
}
