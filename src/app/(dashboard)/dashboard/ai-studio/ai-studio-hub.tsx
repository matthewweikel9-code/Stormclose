"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
	Sparkles,
	Brain,
	MessageSquare,
	FileText,
	Target,
	Users,
	MapPin,
	Compass,
	HandshakeIcon,
	Zap,
	Copy,
	CheckCircle2,
	Loader2,
	AlertCircle,
} from "lucide-react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Badge,
	Button,
} from "@/components/ui";
import type { AiModuleId, AiModuleCard } from "@/types/ai-context";

// ── Module Card Definitions ──────────────────────────────────────────────────

const MODULE_CARDS: AiModuleCard[] = [
	{
		id: "daily_brief",
		title: "Daily Brief",
		description:
			"Morning operations brief summarizing storm activity, missions, and team coverage.",
		icon: "Sparkles",
		category: "operations",
		contextSlots: ["company", "storm", "mission"],
		endpoint: "/api/ai/daily-brief",
		comingSoon: false,
	},
	{
		id: "mission_copilot",
		title: "Mission Copilot",
		description:
			"Real-time AI suggestions during active field missions — pace checks, route advice, and talking points.",
		icon: "Compass",
		category: "field",
		contextSlots: ["company", "mission", "house", "storm"],
		endpoint: "/api/ai/mission-copilot",
		comingSoon: false,
	},
	{
		id: "opportunity_summary",
		title: "Opportunity Summary",
		description:
			"Comprehensive property writeup for CRM handoff with damage context and key metrics.",
		icon: "FileText",
		category: "sales",
		contextSlots: ["company", "house", "storm"],
		endpoint: "/api/ai/opportunity-summary",
		comingSoon: false,
	},
	{
		id: "objection_response",
		title: "Objection Handler",
		description:
			"LAER-framework objection responses with contextual evidence and short-form versions.",
		icon: "MessageSquare",
		category: "sales",
		contextSlots: ["company", "house", "tone"],
		endpoint: "/api/ai/objection-response",
		comingSoon: false,
	},
	{
		id: "negotiation_coach",
		title: "Negotiation Coach",
		description:
			"Strategic pricing, scope, and insurance negotiation guidance tailored to each property.",
		icon: "Handshake",
		category: "sales",
		contextSlots: ["company", "house", "storm", "tone"],
		endpoint: "/api/ai/negotiation-coach",
		comingSoon: false,
	},
	{
		id: "follow_up_writer",
		title: "Follow-Up Writer",
		description:
			"High-converting follow-up drafts for text, email, and voicemail across multiple touch sequences.",
		icon: "Target",
		category: "sales",
		contextSlots: ["company", "house", "tone"],
		endpoint: "/api/ai/follow-up-writer",
		comingSoon: false,
	},
	{
		id: "export_summary",
		title: "Export Summary",
		description:
			"Structured CRM handoff notes with storm evidence, visit timeline, and key fields.",
		icon: "Zap",
		category: "operations",
		contextSlots: ["company", "house", "storm", "mission"],
		endpoint: "/api/ai/export-summary",
		comingSoon: false,
	},
	{
		id: "rep_coaching",
		title: "Rep Coaching",
		description:
			"AI-driven performance coaching insights with strengths, improvements, and action items.",
		icon: "Users",
		category: "team",
		contextSlots: ["company", "rep"],
		endpoint: "/api/ai/rep-coaching",
		comingSoon: false,
	},
	{
		id: "zone_summary",
		title: "Zone Summary",
		description:
			"Storm zone intelligence report with revenue projections, deployment guidance, and urgency scoring.",
		icon: "MapPin",
		category: "operations",
		contextSlots: ["company", "storm"],
		endpoint: "/api/ai/zone-summary",
		comingSoon: false,
	},
];

// ── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
	Sparkles,
	Brain,
	MessageSquare,
	FileText,
	Target,
	Users,
	MapPin,
	Compass,
	Handshake: HandshakeIcon,
	Zap,
};

// ── Category labels & colors ─────────────────────────────────────────────────

const CATEGORY_META: Record<
	string,
	{ label: string; color: string }
> = {
	operations: { label: "Operations", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
	field: { label: "Field", color: "bg-green-500/20 text-green-400 border-green-500/30" },
	sales: { label: "Sales", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
	team: { label: "Team", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

// ── Quick Demo Payloads (for testing each module from the UI) ────────────────

type PrefillContext = {
	houseId: string | null;
	missionId: string | null;
	stopId: string | null;
	opportunityId: string | null;
};

function getQuickDemoPayload(
	moduleId: AiModuleId,
	prefill: PrefillContext,
): Record<string, unknown> {
	const sharedIds = {
		houseId: prefill.houseId,
		missionId: prefill.missionId,
		currentStopId: prefill.stopId,
		opportunityId: prefill.opportunityId,
	};

	const payloads: Record<AiModuleId, Record<string, unknown>> = {
		daily_brief: {
			...sharedIds,
			briefDate: new Date().toISOString().split("T")[0],
			force: true,
		},
		mission_copilot: {
			missionId: prefill.missionId ?? "demo-mission-1",
			suggestionType: "talking_points",
			currentStopId: prefill.stopId,
			repQuestion: null,
		},
		opportunity_summary: {
			houseId: prefill.houseId ?? prefill.opportunityId ?? "demo-house-1",
			includeInsuranceContext: true,
			includeStormEvidence: true,
		},
		objection_response: {
			...sharedIds,
			objection: "Your price is too high compared to the other guy.",
			category: "price",
			projectType: "roof_replacement",
			keyBenefits: ["Storm damage expertise", "Insurance claim assistance"],
		},
		negotiation_coach: {
			...sharedIds,
			scenario: "initial_pricing",
			situationDescription:
				"Homeowner received a competitor quote $2,000 lower. We have better materials and warranty.",
			competitorQuote: 12000,
			ourQuote: 14000,
		},
		follow_up_writer: {
			...sharedIds,
			situation: "post_inspection",
			channel: "text",
			homeownerName: "John Smith",
			lastInteraction: "Completed roof inspection yesterday, found hail damage",
			desiredNextAction: "Schedule adjuster meeting",
			daysSinceLastContact: 1,
			touchNumber: 1,
		},
		export_summary: {
			...sharedIds,
			houseId: prefill.houseId ?? prefill.opportunityId ?? "demo-house-1",
			includeStormEvidence: true,
			includeVisitTimeline: true,
		},
		rep_coaching: {
			repId: "demo-rep-1",
			timeframe: "7d",
			focusArea: "general",
		},
		zone_summary: {
			...sharedIds,
			stormZoneId: "demo-zone-1",
			includeCompetitiveLandscape: true,
			includeRevenueProjection: true,
			includeDeploymentRecommendation: true,
			audience: "manager",
		},
	};
	return payloads[moduleId];
}

// ── Types ────────────────────────────────────────────────────────────────────

type ModuleResult = {
	data: unknown;
	meta: {
		timestamp: string;
		model: string;
		tokenCount: number;
		estimatedCostUsd: number | null;
		latencyMs: number;
	};
};

// ── Component ────────────────────────────────────────────────────────────────

export function AiStudioHub() {
	const searchParams = useSearchParams();
	const prefill = useMemo<PrefillContext>(
		() => ({
			houseId: searchParams.get("houseId"),
			missionId: searchParams.get("missionId"),
			stopId: searchParams.get("stopId"),
			opportunityId: searchParams.get("opportunityId"),
		}),
		[searchParams],
	);

	const [activeModule, setActiveModule] = useState<AiModuleId | null>(null);
	const [loading, setLoading] = useState<AiModuleId | null>(null);
	const [results, setResults] = useState<Record<string, ModuleResult>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [copiedId, setCopiedId] = useState<string | null>(null);

	useEffect(() => {
		const target = searchParams.get("module");
		if (!target) return;
		if (MODULE_CARDS.some((card) => card.id === target)) {
			setActiveModule(target as AiModuleId);
		}
	}, [searchParams]);

	const handleRunModule = useCallback(async (card: AiModuleCard) => {
		setLoading(card.id);
		setErrors((prev) => ({ ...prev, [card.id]: "" }));

		try {
			const payload = {
				context: null,
				params: getQuickDemoPayload(card.id, prefill),
			};
			const res = await fetch(card.endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const json = await res.json();

			if (!res.ok || json.error) {
				setErrors((prev) => ({
					...prev,
					[card.id]: json.error ?? `Request failed (${res.status})`,
				}));
			} else {
				setResults((prev) => ({
					...prev,
					[card.id]: { data: json.data, meta: json.meta },
				}));
				setActiveModule(card.id);
			}
		} catch (err) {
			setErrors((prev) => ({
				...prev,
				[card.id]:
					err instanceof Error ? err.message : "Network error",
			}));
		} finally {
			setLoading(null);
		}
	}, [prefill]);

	const handleCopy = useCallback(
		(moduleId: string) => {
			const result = results[moduleId];
			if (!result) return;
			navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
			setCopiedId(moduleId);
			setTimeout(() => setCopiedId(null), 2000);
		},
		[results],
	);

	const activeResult = activeModule ? results[activeModule] : null;
	const activeCard = activeModule
		? MODULE_CARDS.find((c) => c.id === activeModule) ?? null
		: null;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-white flex items-center gap-2">
						<Sparkles className="h-6 w-6 text-purple-400" />
						AI Studio
					</h1>
					<p className="text-sm text-zinc-400 mt-1">
						Structured AI modules with full context contracts.{" "}
						<span className="text-purple-400">9 modules</span> available.
					</p>
				</div>
			</div>

			{/* Module Grid */}
			<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
				{MODULE_CARDS.map((card) => {
					const Icon = ICON_MAP[card.icon] ?? Brain;
					const cat = CATEGORY_META[card.category] ?? CATEGORY_META.operations;
					const isActive = activeModule === card.id;
					const isLoading = loading === card.id;
					const error = errors[card.id];
					const hasResult = !!results[card.id];

					return (
						<Card
							key={card.id}
							className={`relative transition-all duration-200 cursor-pointer border
								${isActive ? "border-purple-500 bg-storm-z1 ring-1 ring-purple-500/30" : "border-zinc-800 bg-storm-z0 hover:border-zinc-700 hover:bg-storm-z1"}
								${card.comingSoon ? "opacity-50 pointer-events-none" : ""}
							`}
							onClick={() => !card.comingSoon && setActiveModule(card.id)}
						>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<div className="p-2 rounded-lg bg-storm-z2">
											<Icon className="h-5 w-5 text-purple-400" />
										</div>
										<div>
											<CardTitle className="text-sm font-medium text-white">
												{card.title}
											</CardTitle>
											<Badge
												variant="outline"
												className={`text-[10px] mt-1 ${cat.color}`}
											>
												{cat.label}
											</Badge>
										</div>
									</div>
									{hasResult && (
										<CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
									)}
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-xs text-zinc-400 leading-relaxed mb-3">
									{card.description}
								</p>

								{/* Context slots */}
								<div className="flex flex-wrap gap-1 mb-3">
									{card.contextSlots.map((slot) => (
										<span
											key={slot}
											className="text-[10px] px-1.5 py-0.5 rounded bg-storm-z2 text-zinc-500 border border-zinc-800"
										>
											{slot}
										</span>
									))}
								</div>

								{/* Error display */}
								{error && (
									<div className="flex items-center gap-1 text-red-400 text-xs mb-2">
										<AlertCircle className="h-3 w-3" />
										<span className="truncate">{error}</span>
									</div>
								)}

								{/* Action button */}
								<Button
									size="sm"
									variant={isActive ? "default" : "outline"}
									className={`w-full text-xs ${isActive ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-zinc-700 text-zinc-400 hover:text-white"}`}
									onClick={(e) => {
										e.stopPropagation();
										handleRunModule(card);
									}}
									disabled={isLoading || card.comingSoon}
								>
									{isLoading ? (
										<>
											<Loader2 className="h-3 w-3 animate-spin mr-1" />
											Generating…
										</>
									) : (
										<>
											<Zap className="h-3 w-3 mr-1" />
											Run Module
										</>
									)}
								</Button>
							</CardContent>

							{card.comingSoon && (
								<div className="absolute inset-0 flex items-center justify-center bg-storm-bg/80 rounded-xl">
									<Badge variant="outline" className="border-zinc-600 text-zinc-500">
										Coming Soon
									</Badge>
								</div>
							)}
						</Card>
					);
				})}
			</div>

			{/* Result Panel */}
			{activeResult && activeCard && (
				<Card className="border-purple-500/30 bg-storm-z0">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Sparkles className="h-5 w-5 text-purple-400" />
								<CardTitle className="text-white text-base">
									{activeCard.title} — Result
								</CardTitle>
							</div>
							<div className="flex items-center gap-2">
								{/* Meta badges */}
								<Badge
									variant="outline"
									className="text-[10px] border-zinc-700 text-zinc-400"
								>
									{activeResult.meta.model}
								</Badge>
								<Badge
									variant="outline"
									className="text-[10px] border-zinc-700 text-zinc-400"
								>
									{activeResult.meta.tokenCount} tokens
								</Badge>
								{activeResult.meta.estimatedCostUsd !== null && (
									<Badge
										variant="outline"
										className="text-[10px] border-zinc-700 text-zinc-400"
									>
										${activeResult.meta.estimatedCostUsd.toFixed(4)}
									</Badge>
								)}
								<Badge
									variant="outline"
									className="text-[10px] border-zinc-700 text-zinc-400"
								>
									{activeResult.meta.latencyMs}ms
								</Badge>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 px-2 text-zinc-400 hover:text-white"
									onClick={() => handleCopy(activeCard.id)}
								>
									{copiedId === activeCard.id ? (
										<CheckCircle2 className="h-3 w-3 text-green-400" />
									) : (
										<Copy className="h-3 w-3" />
									)}
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<pre className="text-xs text-zinc-300 bg-storm-z2 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap">
							{JSON.stringify(activeResult.data, null, 2)}
						</pre>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
