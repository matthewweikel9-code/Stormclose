import { describe, it, expect, vi, beforeEach } from "vitest";

// ── AI Context types ──────────────────────────────────────────────────────────

import type {
	AiContext,
	AiCompanyProfile,
	AiTonePreference,
	AiModuleId,
	AiModuleCard,
	AiSessionLog,
} from "../src/types/ai-context";

// ── buildContext & promptBuilder ──────────────────────────────────────────────

import {
	getDefaultCompanyProfile,
	getDefaultTonePreference,
	buildHouseContextFromStop,
	buildContext,
} from "../src/lib/ai/buildContext";
import { buildSystemSections } from "../src/lib/ai/promptBuilder";

// ── Module prompt builders & parsers ─────────────────────────────────────────

import {
	buildDailyBriefPrompt,
	parseDailyBriefOutput,
} from "../src/lib/ai/modules/dailyBrief";

import {
	buildMissionCopilotPrompt,
	parseMissionCopilotOutput,
} from "../src/lib/ai/modules/missionCopilot";

import {
	buildOpportunitySummaryPrompt,
	parseOpportunitySummaryOutput,
} from "../src/lib/ai/modules/opportunitySummary";

import {
	buildObjectionResponsePrompt,
	parseObjectionResponseOutput,
} from "../src/lib/ai/modules/objectionResponse";

import {
	buildNegotiationCoachPrompt,
	parseNegotiationCoachOutput,
} from "../src/lib/ai/modules/negotiationCoach";

import {
	buildFollowUpWriterPrompt,
	parseFollowUpWriterOutput,
} from "../src/lib/ai/modules/followUpWriter";

import {
	buildExportSummaryPrompt,
	parseExportSummaryOutput,
} from "../src/lib/ai/modules/exportSummary";

import {
	buildRepCoachingPrompt,
	parseRepCoachingOutput,
} from "../src/lib/ai/modules/repCoaching";

import {
	buildZoneSummaryPrompt,
	parseZoneSummaryOutput,
} from "../src/lib/ai/modules/zoneSummary";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMinimalContext(overrides: Partial<AiContext> = {}): AiContext {
	return {
		companyProfile: getDefaultCompanyProfile(),
		stormContext: null,
		houseContext: null,
		missionContext: null,
		repContext: null,
		tonePreference: getDefaultTonePreference(),
		outputFormat: "markdown",
		userNotes: null,
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AI Context Types
// ═══════════════════════════════════════════════════════════════════════════════

describe("AI Context Types", () => {
	it("AiModuleId union contains all 9 modules", () => {
		const ids: AiModuleId[] = [
			"daily_brief",
			"mission_copilot",
			"opportunity_summary",
			"objection_response",
			"negotiation_coach",
			"follow_up_writer",
			"export_summary",
			"rep_coaching",
			"zone_summary",
		];
		expect(ids).toHaveLength(9);
		// TypeScript compilation itself validates the union — this is a runtime guard
		ids.forEach((id) => expect(typeof id).toBe("string"));
	});

	it("AiModuleCard shape is correct", () => {
		const card: AiModuleCard = {
			id: "daily_brief",
			title: "Daily Brief",
			description: "test",
			icon: "Sparkles",
			category: "operations",
			contextSlots: ["company", "storm"],
			endpoint: "/api/ai/daily-brief",
			comingSoon: false,
		};
		expect(card.id).toBe("daily_brief");
		expect(card.contextSlots).toContain("company");
	});

	it("AiSessionLog shape is correct", () => {
		const log: AiSessionLog = {
			id: "log-1",
			userId: "user-1",
			moduleId: "daily_brief",
			requestPayload: {},
			responsePayload: {},
			model: "gpt-4o-mini",
			tokenCount: 100,
			estimatedCostUsd: 0.001,
			latencyMs: 250,
			createdAt: new Date().toISOString(),
		};
		expect(log.moduleId).toBe("daily_brief");
		expect(log.tokenCount).toBe(100);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. buildContext utilities
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildContext utilities", () => {
	describe("getDefaultCompanyProfile", () => {
		it("returns a valid company profile", () => {
			const profile = getDefaultCompanyProfile();
			expect(profile.companyName).toBe("Stormclose Roofing");
			expect(profile.certifications).toContain("GAF Master Elite");
			expect(profile.yearsInBusiness).toBeGreaterThan(0);
			expect(profile.financingAvailable).toBe(true);
			expect(profile.valuePropositions.length).toBeGreaterThan(0);
		});
	});

	describe("getDefaultTonePreference", () => {
		it("returns professional / standard defaults", () => {
			const tone = getDefaultTonePreference();
			expect(tone.voice).toBe("professional");
			expect(tone.lengthPreference).toBe("standard");
			expect(tone.includeInsuranceLanguage).toBe(true);
			expect(tone.includeFinancingLanguage).toBe(true);
			expect(tone.bannedPhrases).toEqual([]);
		});
	});

	describe("buildHouseContextFromStop", () => {
		it("maps stop fields to AiHouseContext", () => {
			const house = buildHouseContextFromStop({
				address: "123 Oak St",
				city: "Dallas",
				state: "TX",
				zip: "75201",
				opportunityScore: 85,
				scoreTier: "hot",
				stormSeverity: "severe",
				status: "pending",
				notes: "Large roof, homeowner interested",
			});

			expect(house.address).toBe("123 Oak St");
			expect(house.cityStateZip).toContain("Dallas");
			expect(house.opportunityScore).toBe(85);
			expect(house.scoreTier).toBe("hot");
			expect(house.stormSeverity).toBe("severe");
			expect(house.repNotes).toContain("Large roof");
		});

		it("handles missing optional fields gracefully", () => {
			const house = buildHouseContextFromStop({ address: "456 Pine St" });
			expect(house.address).toBe("456 Pine St");
			expect(house.opportunityScore).toBe(0);
			expect(house.scoreTier).toBe("moderate");
			expect(house.homeownerName).toBeNull();
		});
	});

	describe("buildContext", () => {
		it("assembles full context with defaults", async () => {
			const ctx = await buildContext({ userId: "test-user" });
			expect(ctx.companyProfile.companyName).toBe("Stormclose Roofing");
			expect(ctx.tonePreference.voice).toBe("professional");
			expect(ctx.stormContext).toBeNull();
			expect(ctx.houseContext).toBeNull();
			expect(ctx.missionContext).toBeNull();
			expect(ctx.repContext).toBeNull();
			expect(ctx.outputFormat).toBe("markdown");
		});

		it("passes through provided context blocks", async () => {
			const stormContext = {
				zoneName: "Dallas Zone 1",
				zoneId: "zone-1",
				score: 85,
				severity: "severe" as const,
				eventType: "hail" as const,
				maxHailSizeInches: 2.0,
				maxWindSpeedMph: 70,
				stormDate: "2026-03-10",
				stormAgeDays: 5,
				houseCount: 200,
				unworkedHouseCount: 150,
				activeMissionCount: 2,
				polygon: null,
			};

			const ctx = await buildContext({
				userId: "test-user",
				stormContext,
				userNotes: "Focus on north quadrant",
				outputFormat: "json",
			});

			expect(ctx.stormContext?.zoneName).toBe("Dallas Zone 1");
			expect(ctx.userNotes).toBe("Focus on north quadrant");
			expect(ctx.outputFormat).toBe("json");
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. promptBuilder
// ═══════════════════════════════════════════════════════════════════════════════

describe("promptBuilder", () => {
	it("buildSystemSections includes company profile", () => {
		const ctx = makeMinimalContext();
		const sections = buildSystemSections(ctx);
		expect(sections).toContain("## COMPANY PROFILE");
		expect(sections).toContain("Stormclose Roofing");
		expect(sections).toContain("GAF Master Elite");
	});

	it("buildSystemSections includes tone section", () => {
		const ctx = makeMinimalContext({
			tonePreference: {
				...getDefaultTonePreference(),
				voice: "urgent",
				bannedPhrases: ["act now"],
			},
		});
		const sections = buildSystemSections(ctx);
		expect(sections).toContain("## TONE: URGENT");
		expect(sections).toContain("act now");
	});

	it("buildSystemSections includes storm context when provided", () => {
		const ctx = makeMinimalContext({
			stormContext: {
				zoneName: "Test Zone",
				zoneId: "z-1",
				score: 90,
				severity: "severe",
				eventType: "hail",
				maxHailSizeInches: 2.5,
				maxWindSpeedMph: 75,
				stormDate: "2026-03-10",
				stormAgeDays: 3,
				houseCount: 100,
				unworkedHouseCount: 80,
				activeMissionCount: 1,
				polygon: null,
			},
		});
		const sections = buildSystemSections(ctx);
		expect(sections).toContain("## STORM CONTEXT");
		expect(sections).toContain("Test Zone");
		expect(sections).toContain("2.5");
	});

	it("buildSystemSections includes user notes when provided", () => {
		const ctx = makeMinimalContext({ userNotes: "Target the cul-de-sac first" });
		const sections = buildSystemSections(ctx);
		expect(sections).toContain("Target the cul-de-sac first");
	});

	it("buildSystemSections omits missing optional context blocks", () => {
		const ctx = makeMinimalContext();
		const sections = buildSystemSections(ctx);
		expect(sections).not.toContain("## STORM CONTEXT");
		expect(sections).not.toContain("## PROPERTY CONTEXT");
		expect(sections).not.toContain("## MISSION CONTEXT");
		expect(sections).not.toContain("## REP CONTEXT");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Module prompt builders → { system, user } shape
// ═══════════════════════════════════════════════════════════════════════════════

describe("Module prompt builders", () => {
	const ctx = makeMinimalContext();

	it("dailyBrief prompt builder returns system + user", () => {
		const { system, user } = buildDailyBriefPrompt(ctx, {
			briefDate: "2026-03-15",
			focusAreas: "storms",
			force: false,
		});
		expect(system).toContain("operations brief");
		expect(user).toContain("2026-03-15");
		expect(user).toContain("storms");
	});

	it("missionCopilot prompt builder returns system + user", () => {
		const { system, user } = buildMissionCopilotPrompt(ctx, {
			suggestionType: "pace_check",
			missionId: "m-1",
			currentStopId: "stop-1",
			repQuestion: "Am I behind schedule?",
		});
		expect(system).toContain("copilot");
		expect(user).toContain("pace_check");
		expect(user).toContain("Am I behind schedule?");
	});

	it("opportunitySummary prompt builder returns system + user", () => {
		const { system, user } = buildOpportunitySummaryPrompt(ctx, {
			houseId: "h-1",
			includeInsuranceContext: true,
			includeStormEvidence: true,
			customSections: ["warranty details"],
			outputFormat: "markdown",
		});
		expect(system).toContain("opportunity");
		expect(user).toContain("h-1");
		expect(user).toContain("warranty details");
	});

	it("objectionResponse prompt builder returns system + user", () => {
		const { system, user } = buildObjectionResponsePrompt(ctx, {
			objection: "Your price is too high",
			category: "price",
			templateId: null,
			homeownerName: "John",
			projectType: "roof_replacement",
			keyBenefits: ["Quality materials"],
			evidencePoints: ["2-inch hail damage"],
			tone: "consultative",
		});
		expect(system).toContain("LAER");
		expect(user).toContain("Your price is too high");
		expect(user).toContain("John");
	});

	it("negotiationCoach prompt builder returns system + user", () => {
		const { system, user } = buildNegotiationCoachPrompt(ctx, {
			scenario: "competitor_comparison",
			houseId: null,
			situationDescription: "Homeowner has a lower bid",
			homeownerConcern: "The other company is $2k cheaper",
			competitorQuote: 12000,
			ourQuote: 14000,
			insuranceClaimAmount: null,
		});
		expect(system).toContain("negotiation");
		expect(user).toContain("competitor_comparison");
		expect(user).toContain("$12,000");
	});

	it("followUpWriter prompt builder returns system + user", () => {
		const { system, user } = buildFollowUpWriterPrompt(ctx, {
			situation: "ghosted",
			channel: "text",
			houseId: null,
			homeownerName: "Jane Doe",
			lastInteraction: "Completed inspection 2 weeks ago",
			desiredNextAction: "Schedule adjuster meeting",
			daysSinceLastContact: 14,
			touchNumber: 3,
			customInstructions: null,
		});
		expect(system).toContain("AIDA");
		expect(user).toContain("ghosted");
		expect(user).toContain("Jane Doe");
		expect(user).toContain("touch #3");
	});

	it("exportSummary prompt builder returns system + user", () => {
		const { system, user } = buildExportSummaryPrompt(ctx, {
			houseId: "h-1",
			exportId: "exp-1",
			includeStormEvidence: true,
			includeVisitTimeline: true,
			customNotes: "Priority customer",
		});
		expect(system).toContain("export");
		expect(user).toContain("h-1");
		expect(user).toContain("Priority customer");
	});

	it("repCoaching prompt builder returns system + user", () => {
		const { system, user } = buildRepCoachingPrompt(ctx, {
			repId: "rep-1",
			timeframe: "30d",
			focusArea: "conversion",
		});
		expect(system).toContain("coaching");
		expect(user).toContain("rep-1");
		expect(user).toContain("30d");
	});

	it("zoneSummary prompt builder returns system + user", () => {
		const { system, user } = buildZoneSummaryPrompt(ctx, {
			stormZoneId: "zone-1",
			includeCompetitiveLandscape: true,
			includeRevenueProjection: true,
			includeDeploymentRecommendation: true,
			audience: "owner",
		});
		expect(system).toContain("intelligence");
		expect(user).toContain("zone-1");
		expect(user).toContain("owner");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Module parsers — valid JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe("Module parsers — valid JSON", () => {
	it("parseDailyBriefOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			summary: "All systems operational. 3 storms tracked.",
			highlights: [
				{ category: "storm", text: "New storm in Plano", href: "/dashboard/storms" },
			],
		});
		const out = parseDailyBriefOutput(raw, "gpt-4o-mini", 150);
		expect(out.summary).toContain("All systems");
		expect(out.highlights).toHaveLength(1);
		expect(out.highlights[0].category).toBe("storm");
		expect(out.model).toBe("gpt-4o-mini");
		expect(out.tokenCount).toBe(150);
	});

	it("parseMissionCopilotOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			suggestion: "You're on pace. Next stop: 456 Pine St.",
			talkingPoints: ["2-inch hail confirmed", "Roof is 15 years old"],
			paceAnalysis: {
				currentDoorsPerHour: 12,
				targetDoorsPerHour: 15,
				projectedCompletion: "3:30 PM",
				suggestion: "Pick up pace slightly",
			},
		});
		const params = {
			suggestionType: "pace_check" as const,
			missionId: "m-1",
			currentStopId: null,
			repQuestion: null,
		};
		const out = parseMissionCopilotOutput(raw, params, "gpt-4o-mini", 200);
		expect(out.suggestionType).toBe("pace_check");
		expect(out.talkingPoints).toHaveLength(2);
		expect(out.paceAnalysis?.currentDoorsPerHour).toBe(12);
	});

	it("parseObjectionResponseOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			response: "I completely understand your concern about pricing...",
			framework: {
				listen: "I hear you",
				acknowledge: "That's a fair concern",
				explore: "Can I ask what the other bid includes?",
				respond: "Here's what sets us apart...",
			},
			shortVersion: "Totally understand. We include things others charge extra for.",
			followUpQuestion: "Would it help if I showed you a side-by-side comparison?",
		});
		const out = parseObjectionResponseOutput(raw, "gpt-4o-mini", 180);
		expect(out.framework.listen).toBe("I hear you");
		expect(out.shortVersion.length).toBeLessThan(100);
		expect(out.followUpQuestion).toBeTruthy();
	});

	it("parseNegotiationCoachOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			strategy: "Anchor high, justify with value...",
			talkingPoints: ["We include permits", "50-year warranty"],
			avoidSaying: ["cheap", "discount"],
			pricingGuidance: {
				suggestedAnchorPrice: "$15,500",
				justification: "Premium materials + labor",
				concessionLadder: ["Remove gutter guards", "Reduce skylight scope"],
			},
			closingTechnique: {
				name: "Assumptive Close",
				script: "Let's get you on the schedule for next Tuesday.",
			},
		});
		const out = parseNegotiationCoachOutput(raw, "gpt-4o-mini", 250);
		expect(out.talkingPoints).toHaveLength(2);
		expect(out.avoidSaying).toContain("cheap");
		expect(out.pricingGuidance?.suggestedAnchorPrice).toBe("$15,500");
		expect(out.closingTechnique.name).toBe("Assumptive Close");
	});

	it("parseFollowUpWriterOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			message: "Hi John, just checking in after our inspection yesterday...",
			subjectLine: null,
			wordCount: 25,
			suggestedSendTime: "Tomorrow 9am",
			nextTouchSuggestion: { day: 3, channel: "text", purpose: "Value reminder" },
		});
		const params = {
			situation: "post_inspection" as const,
			channel: "text" as const,
			houseId: null,
			homeownerName: "John",
			lastInteraction: "Inspection done",
			desiredNextAction: "Schedule adjuster",
			daysSinceLastContact: 1,
			touchNumber: 1,
			customInstructions: null,
		};
		const out = parseFollowUpWriterOutput(raw, params, "gpt-4o-mini", 120);
		expect(out.message).toContain("checking in");
		expect(out.channel).toBe("text");
		expect(out.nextTouchSuggestion?.day).toBe(3);
	});

	it("parseExportSummaryOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			summary: "Property at 123 Oak St shows significant hail damage.",
			crmFields: {
				contactName: "John Smith",
				contactPhone: "555-1234",
				propertyAddress: "123 Oak St, Dallas TX",
				leadSource: "Stormclose AI",
				estimatedValue: "$14,500",
				stormEvent: "March 2026 Hail",
				damageType: "Hail impact, cracked shingles",
				interestLevel: "high",
				nextAction: "Schedule adjuster meeting",
			},
			visitTimeline: [
				{ timestamp: "2026-03-12 10:00", action: "Knocked", outcome: "Interested" },
			],
		});
		const out = parseExportSummaryOutput(raw, "gpt-4o-mini", 300);
		expect(out.crmFields.contactName).toBe("John Smith");
		expect(out.crmFields.interestLevel).toBe("high");
		expect(out.visitTimeline).toHaveLength(1);
	});

	it("parseRepCoachingOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			executiveSummary: "Rep is performing above average with strong conversion.",
			strengths: [{ area: "Conversion", observation: "25% above average", metric: "32%" }],
			improvements: [
				{ area: "Pace", observation: "Below target", metric: "11 doors/hr", actionItem: "Set timer reminders" },
			],
			coachingActions: [{ priority: 1, action: "Practice 30-second pitch", expectedImpact: "Higher contact rate" }],
			trend: "improving",
		});
		const out = parseRepCoachingOutput(raw, "gpt-4o-mini", 350);
		expect(out.trend).toBe("improving");
		expect(out.strengths).toHaveLength(1);
		expect(out.improvements[0].actionItem).toContain("timer");
		expect(out.coachingActions[0].priority).toBe(1);
	});

	it("parseZoneSummaryOutput parses valid JSON", () => {
		const raw = JSON.stringify({
			narrative: "The Dallas Zone 1 represents significant opportunity...",
			keyStats: [{ label: "Total Homes", value: "200", context: "Within impact radius" }],
			deploymentRecommendation: {
				suggestedTeamSize: 3,
				estimatedDays: 5,
				priorityAreas: ["North quadrant", "Oak Lane cul-de-sac"],
				reasoning: "Highest density of unworked properties",
			},
			revenueProjection: {
				lowEstimate: 250000,
				midEstimate: 400000,
				highEstimate: 600000,
				assumptions: ["30% contact rate", "25% close rate"],
			},
			urgencyScore: 78,
			urgencyRationale: "Storm is 5 days old, competitors spotted in area",
		});
		const out = parseZoneSummaryOutput(raw, "gpt-4o-mini", 400);
		expect(out.urgencyScore).toBe(78);
		expect(out.deploymentRecommendation?.suggestedTeamSize).toBe(3);
		expect(out.revenueProjection?.midEstimate).toBe(400000);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Module parsers — fallback on invalid JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe("Module parsers — fallback on invalid JSON", () => {
	it("parseDailyBriefOutput falls back on invalid JSON", () => {
		const out = parseDailyBriefOutput("not json", "gpt-4o-mini", 50);
		expect(out.summary).toBe("not json");
		expect(out.highlights).toEqual([]);
	});

	it("parseMissionCopilotOutput falls back on invalid JSON", () => {
		const params = {
			suggestionType: "talking_points" as const,
			missionId: "m-1",
			currentStopId: null,
			repQuestion: null,
		};
		const out = parseMissionCopilotOutput("bad data", params, "gpt-4o-mini", 30);
		expect(out.suggestion).toBe("bad data");
		expect(out.talkingPoints).toBeNull();
	});

	it("parseObjectionResponseOutput falls back on invalid JSON", () => {
		const out = parseObjectionResponseOutput("malformed", "gpt-4o-mini", 25);
		expect(out.response).toBe("malformed");
		expect(out.framework.listen).toBe("");
	});

	it("parseNegotiationCoachOutput falls back on invalid JSON", () => {
		const out = parseNegotiationCoachOutput("nope", "gpt-4o-mini", 20);
		expect(out.strategy).toBe("nope");
		expect(out.talkingPoints).toEqual([]);
	});

	it("parseFollowUpWriterOutput falls back on invalid JSON", () => {
		const params = {
			situation: "ghosted" as const,
			channel: "email" as const,
			houseId: null,
			homeownerName: "Jane",
			lastInteraction: "2 weeks ago",
			desiredNextAction: "call",
			daysSinceLastContact: 14,
			touchNumber: 3,
			customInstructions: null,
		};
		const out = parseFollowUpWriterOutput("broken", params, "gpt-4o-mini", 15);
		expect(out.message).toBe("broken");
		expect(out.subjectLine).toBeNull();
	});

	it("parseExportSummaryOutput falls back on invalid JSON", () => {
		const out = parseExportSummaryOutput("invalid", "gpt-4o-mini", 10);
		expect(out.summary).toBe("invalid");
		expect(out.crmFields.contactName).toBe("Unknown");
	});

	it("parseRepCoachingOutput falls back on invalid JSON", () => {
		const out = parseRepCoachingOutput("garbage", "gpt-4o-mini", 5);
		expect(out.executiveSummary).toBe("garbage");
		expect(out.trend).toBe("stable");
	});

	it("parseZoneSummaryOutput falls back on invalid JSON", () => {
		const out = parseZoneSummaryOutput("???", "gpt-4o-mini", 3);
		expect(out.narrative).toBe("???");
		expect(out.urgencyScore).toBe(50);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. API route shape (integration-style — tests without OpenAI key)
// ═══════════════════════════════════════════════════════════════════════════════

describe("AI API routes — envelope shape", () => {
	// We test the routes through the Next.js handler pattern.
	// Since we don't have a real OpenAI key in tests, we verify error handling.
	// The routes require OPENAI_API_KEY, so they should return 500 with a clear error.

	const originalEnv = process.env.NODE_ENV;

	beforeEach(() => {
		process.env.NODE_ENV = "test";
		// Ensure no API key is set so we hit the error path
		delete process.env.OPENAI_API_KEY;
	});

	async function importRoute(modulePath: string) {
		return await import(modulePath);
	}

	it("daily-brief route returns error envelope without API key", async () => {
		const { POST } = await importRoute("../src/app/api/ai/daily-brief/route");
		const req = new Request("http://localhost/api/ai/daily-brief", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				context: null,
				params: { briefDate: "2026-03-15" },
			}),
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(500);
		expect(json.error).toBeTruthy();
		expect(json.meta).toBeDefined();
		expect(json.meta.timestamp).toBeTruthy();
	});

	it("objection-response route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/objection-response/route");
		const req = new Request("http://localhost/api/ai/objection-response", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }), // missing objection
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("objection is required");
	});

	it("mission-copilot route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/mission-copilot/route");
		const req = new Request("http://localhost/api/ai/mission-copilot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }), // missing missionId + suggestionType
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("missionId and suggestionType are required");
	});

	it("negotiation-coach route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/negotiation-coach/route");
		const req = new Request("http://localhost/api/ai/negotiation-coach", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: { scenario: "initial_pricing" } }), // missing situationDescription
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("scenario and situationDescription are required");
	});

	it("follow-up route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/follow-up/route");
		const req = new Request("http://localhost/api/ai/follow-up", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: { homeownerName: "John" } }), // missing lastInteraction + desiredNextAction
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("homeownerName, lastInteraction, and desiredNextAction are required");
	});

	it("follow-up-writer alias route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/follow-up-writer/route");
		const req = new Request("http://localhost/api/ai/follow-up-writer", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: { homeownerName: "John" } }),
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("homeownerName, lastInteraction, and desiredNextAction are required");
	});

	it("export-summary route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/export-summary/route");
		const req = new Request("http://localhost/api/ai/export-summary", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }), // missing houseId
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("houseId is required");
	});

	it("rep-coaching route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/rep-coaching/route");
		const req = new Request("http://localhost/api/ai/rep-coaching", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }), // missing repId
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("repId is required");
	});

	it("zone-summary route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/zone-summary/route");
		const req = new Request("http://localhost/api/ai/zone-summary", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }), // missing stormZoneId
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("stormZoneId is required");
	});

	it("opportunity-summary route validates required fields", async () => {
		const { POST } = await importRoute("../src/app/api/ai/opportunity-summary/route");
		const req = new Request("http://localhost/api/ai/opportunity-summary", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ params: {} }),
		});

		const res = await POST(req);
		const json = await res.json();

		expect(res.status).toBe(400);
		expect(json.error).toContain("houseId is required");
	});
});
