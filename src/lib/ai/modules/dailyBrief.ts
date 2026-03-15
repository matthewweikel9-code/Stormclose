type DailyBriefContext = Record<string, unknown>;

type BuildDailyBriefOptions = {
	briefDate: string;
	focusAreas: string | null;
	force: boolean;
};

type DailyBriefOutput = {
	summary: string;
	highlights: Array<{ category: string; text: string; href?: string }>;
	generatedAt: string;
	model: string;
	tokenCount: number;
};

export function buildDailyBriefPrompt(context: DailyBriefContext, options: BuildDailyBriefOptions) {
	const system = [
		"You are StormClose's operations co-pilot.",
		"Return a concise daily operational brief for a roofing sales + field team.",
		"Prefer practical recommendations and clear sequencing.",
		"If inputs are sparse, produce a useful fallback brief.",
	].join(" ");

	const user = [
		`Brief Date: ${options.briefDate}`,
		`Focus Areas: ${options.focusAreas ?? "General operations"}`,
		`Force Refresh: ${options.force ? "yes" : "no"}`,
		"Context:",
		JSON.stringify(context, null, 2),
		"",
		"Output format:",
		"1) One paragraph summary.",
		"2) 3-6 bullet highlights with action-oriented language.",
	].join("\n");

	return { system, user };
}

function extractHighlights(content: string) {
	const lines = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => /^[-*•]/.test(line));

	return lines.slice(0, 6).map((line) => ({
		category: "operations",
		text: line.replace(/^[-*•]\s*/, ""),
	}));
}

export function parseDailyBriefOutput(content: string, model: string, tokenCount: number): DailyBriefOutput {
	const summary = content.trim();
	const highlights = extractHighlights(content);

	return {
		summary:
			summary.length > 0
				? summary
				: "No AI summary was generated. Continue current mission and export priorities.",
		highlights,
		generatedAt: new Date().toISOString(),
		model,
		tokenCount,
	};
}
