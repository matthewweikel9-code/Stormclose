// ── AI Prompt Builder ─────────────────────────────────────────────────────────
// Converts AiContext into system prompt sections.
// Each module calls buildSystemSections() to inject relevant context.

import type { AiContext, AiTonePreference } from "@/types/ai-context";

function toneParagraph(tone: AiTonePreference): string {
	const voiceMap: Record<AiTonePreference["voice"], string> = {
		professional: "Use polished, industry-standard language. Be precise and authoritative.",
		friendly: "Use warm, neighborly language. Emphasize relationships and trust.",
		consultative: "Position yourself as an advisor. Ask questions, educate, offer options.",
		confident: "Be assertive and data-driven. Use specific numbers and case studies.",
		empathetic: "Lead with understanding. Validate concerns. Use relatable stories.",
		urgent: "Be action-oriented and deadline-focused. Emphasize consequences of delay.",
	};

	const lines = [
		`## TONE: ${tone.voice.toUpperCase()}`,
		voiceMap[tone.voice],
	];

	if (tone.lengthPreference === "concise") {
		lines.push("Keep output concise — no filler, maximum impact.");
	} else if (tone.lengthPreference === "detailed") {
		lines.push("Provide detailed, comprehensive output with supporting evidence.");
	}

	if (tone.includeInsuranceLanguage) {
		lines.push("Include insurance claim and carrier-specific language where relevant.");
	}
	if (tone.includeFinancingLanguage) {
		lines.push("Mention financing options when relevant to the homeowner's situation.");
	}
	if (tone.bannedPhrases.length > 0) {
		lines.push(`NEVER use these phrases: ${tone.bannedPhrases.join(", ")}`);
	}
	if (tone.customSystemPromptSuffix) {
		lines.push("", tone.customSystemPromptSuffix);
	}

	return lines.join("\n");
}

export function buildSystemSections(ctx: AiContext): string {
	const sections: string[] = [];

	// Company profile
	const cp = ctx.companyProfile;
	sections.push([
		"## COMPANY PROFILE",
		`Company: ${cp.companyName}`,
		`Service Area: ${cp.serviceArea.join(", ")}`,
		`Certifications: ${cp.certifications.join(", ")}`,
		`Years in Business: ${cp.yearsInBusiness}`,
		`Warranty: ${cp.warrantyDescription}`,
		`Carrier Experience: ${cp.carrierExperience.join(", ")}`,
		`Financing: ${cp.financingAvailable ? "Available" : "Not offered"}`,
		`Value Propositions:\n${cp.valuePropositions.map((v) => `- ${v}`).join("\n")}`,
	].join("\n"));

	// Storm context
	if (ctx.stormContext) {
		const s = ctx.stormContext;
		sections.push([
			"## STORM CONTEXT",
			`Zone: ${s.zoneName} (Score: ${s.score}/100, Severity: ${s.severity})`,
			`Event Type: ${s.eventType}`,
			s.maxHailSizeInches ? `Max Hail: ${s.maxHailSizeInches}"` : null,
			s.maxWindSpeedMph ? `Max Wind: ${s.maxWindSpeedMph} mph` : null,
			`Storm Age: ${s.stormAgeDays} days`,
			`Houses: ${s.houseCount} total, ${s.unworkedHouseCount} unworked`,
			`Active Missions in Zone: ${s.activeMissionCount}`,
		].filter(Boolean).join("\n"));
	}

	// House context
	if (ctx.houseContext) {
		const h = ctx.houseContext;
		sections.push([
			"## PROPERTY CONTEXT",
			`Address: ${h.address}, ${h.cityStateZip}`,
			`Opportunity Score: ${h.opportunityScore}/100 (${h.scoreTier})`,
			`Storm Severity: ${h.stormSeverity}`,
			`Estimated Value: ${h.estimatedValueBand}`,
			h.yearBuilt ? `Year Built: ${h.yearBuilt}` : null,
			h.roofAge ? `Roof Age: ${h.roofAge} years` : null,
			h.assessedValue ? `Assessed Value: $${h.assessedValue.toLocaleString()}` : null,
			h.stopStatus ? `Current Status: ${h.stopStatus}` : null,
			h.priorAttempts > 0 ? `Prior Attempts: ${h.priorAttempts}` : null,
			h.homeownerName ? `Homeowner: ${h.homeownerName}` : null,
			h.repNotes ? `Rep Notes: ${h.repNotes}` : null,
		].filter(Boolean).join("\n"));
	}

	// Mission context
	if (ctx.missionContext) {
		const m = ctx.missionContext;
		sections.push([
			"## MISSION CONTEXT",
			`Mission: ${m.missionName} (${m.status})`,
			m.stormZoneName ? `Storm Zone: ${m.stormZoneName}` : null,
			m.assignedRepName ? `Assigned Rep: ${m.assignedRepName}` : null,
			`Progress: ${m.stopsCompleted}/${m.totalStops} stops (${m.completionPercent}%)`,
			`Outcomes: ${m.interestedCount} interested, ${m.noAnswerCount} no answer, ${m.notInterestedCount} not interested`,
			m.durationMinutes ? `Duration: ${m.durationMinutes} minutes` : null,
		].filter(Boolean).join("\n"));
	}

	// Rep context
	if (ctx.repContext) {
		const r = ctx.repContext;
		sections.push([
			"## REP CONTEXT",
			`Rep: ${r.name} (${r.fieldStatus})`,
			`Today: ${r.doorsTodayCount} doors, ${r.appointmentsTodayCount} appointments, ${r.interestedTodayCount} interested`,
			`No-Answer Rate: ${Math.round(r.noAnswerRate * 100)}%`,
			`Avg Doors/Hour: ${r.avgDoorsPerHour.toFixed(1)}`,
			r.activeMissionName ? `Active Mission: ${r.activeMissionName}` : null,
			`Recent Outcomes: ${r.recentOutcomes.slice(0, 10).join(", ") || "none"}`,
		].filter(Boolean).join("\n"));
	}

	// Tone
	sections.push(toneParagraph(ctx.tonePreference));

	// User notes
	if (ctx.userNotes) {
		sections.push(`## ADDITIONAL NOTES FROM USER\n${ctx.userNotes}`);
	}

	return sections.join("\n\n");
}
