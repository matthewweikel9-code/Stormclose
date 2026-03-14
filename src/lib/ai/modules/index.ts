// ── AI Modules barrel export ──────────────────────────────────────────────────

export {
	buildDailyBriefPrompt,
	parseDailyBriefOutput,
	type DailyBriefParams,
	type DailyBriefOutput,
} from "./dailyBrief";

export {
	buildMissionCopilotPrompt,
	parseMissionCopilotOutput,
	type MissionCopilotParams,
	type MissionCopilotOutput,
	type CopilotSuggestionType,
} from "./missionCopilot";

export {
	buildOpportunitySummaryPrompt,
	parseOpportunitySummaryOutput,
	type OpportunitySummaryParams,
	type OpportunitySummaryOutput,
} from "./opportunitySummary";

export {
	buildObjectionResponsePrompt,
	parseObjectionResponseOutput,
	type ObjectionResponseParams,
	type ObjectionResponseOutput,
	type ObjectionCategory,
} from "./objectionResponse";

export {
	buildNegotiationCoachPrompt,
	parseNegotiationCoachOutput,
	type NegotiationCoachParams,
	type NegotiationCoachOutput,
	type NegotiationScenario,
} from "./negotiationCoach";

export {
	buildFollowUpWriterPrompt,
	parseFollowUpWriterOutput,
	type FollowUpWriterParams,
	type FollowUpWriterOutput,
	type FollowUpChannel,
	type FollowUpSituation,
} from "./followUpWriter";

export {
	buildExportSummaryPrompt,
	parseExportSummaryOutput,
	type ExportSummaryParams,
	type ExportSummaryOutput,
} from "./exportSummary";

export {
	buildRepCoachingPrompt,
	parseRepCoachingOutput,
	type RepCoachingParams,
	type RepCoachingOutput,
	type CoachingTimeframe,
} from "./repCoaching";

export {
	buildZoneSummaryPrompt,
	parseZoneSummaryOutput,
	type ZoneSummaryParams,
	type ZoneSummaryOutput,
} from "./zoneSummary";
