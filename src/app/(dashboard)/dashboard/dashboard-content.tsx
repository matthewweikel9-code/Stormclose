"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader, StatCard, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";
import { hasFeature, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface DashboardContentProps {
	user: {
		email?: string | null;
	};
	subscriptionStatus: string;
	subscriptionTier?: SubscriptionTier;
	logoutAction: () => Promise<void>;
}

const quickActions = [
	{
		title: "Objection Responses",
		description: "AI-powered responses to homeowner objections.",
		href: "/dashboard/objection",
		feature: "objection_handler" as const,
		tier: "Pro",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
				/>
			</svg>
		),
	},
	{
		title: "Supplement Generator",
		description: "Find missing Xactimate line items automatically.",
		href: "/dashboard/supplements",
		feature: "supplement_generator" as const,
		tier: "Pro+",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
		),
	},
	{
		title: "Negotiation Coach",
		description: "Real-time guidance for adjuster negotiations.",
		href: "/dashboard/negotiation",
		feature: "negotiation_coach" as const,
		tier: "Pro+",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
				/>
			</svg>
		),
	},
	{
		title: "Carrier Intelligence",
		description: "Know how each insurance carrier operates.",
		href: "/dashboard/carriers",
		feature: "carrier_intelligence" as const,
		tier: "Enterprise",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
				/>
			</svg>
		),
	},
	{
		title: "Lead Generator",
		description: "Search properties and find high-potential leads.",
		href: "/dashboard/leads",
		feature: "lead_generator" as const,
		tier: "Enterprise",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
				/>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		),
	},
	{
		title: "Live Roof Measurement AI",
		description: "Instant satellite measurements for any address.",
		href: "/dashboard/roof-measure",
		feature: "roof_measurement" as const,
		tier: "Pro+",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
	},
];

export function DashboardContent({
	user,
	subscriptionStatus,
	subscriptionTier = "free",
	logoutAction,
}: DashboardContentProps) {

	const getTierDisplay = () => {
		switch (subscriptionTier) {
			case "enterprise":
				return "Enterprise";
			case "pro_plus":
				return "Pro+";
			case "pro":
				return "Pro";
			case "trial":
				return "Trial";
			default:
				return "Free";
		}
	};

	const getTierDescription = () => {
		switch (subscriptionTier) {
			case "enterprise":
				return "All features unlocked";
			case "pro_plus":
				return "Advanced AI features";
			case "pro":
				return "Active plan";
			case "trial":
				return "7-day trial";
			default:
				return "Limited features";
		}
	};

	const getTierBadgeStyle = (tier: string) => {
		switch (tier) {
			case "Enterprise":
				return "bg-emerald-500/20 text-emerald-400";
			case "Pro+":
				return "bg-amber-500/20 text-amber-400";
			case "Pro":
				return "bg-[#6D5CFF]/20 text-[#A78BFA]";
			default:
				return "bg-slate-700 text-slate-400";
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-8">
			{/* Header */}
			<PageHeader
				kicker="Dashboard"
				title={`Welcome back${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
				description="Your AI-powered insurance negotiation command center."
				actions={
					<form action={logoutAction}>
						<Button type="submit" variant="secondary">
							Sign Out
						</Button>
					</form>
				}
			/>

			{/* Stats Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Supplements Won"
					value="12"
					description="$47,500 recovered"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Negotiation Win Rate"
					value="78%"
					description="+12% vs last month"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Storm Alerts"
					value="8"
					description="3 active zones"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Subscription"
					value={getTierDisplay()}
					description={getTierDescription()}
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
							/>
						</svg>
					}
				/>
			</div>

			{/* Upgrade Banner (for non-enterprise users) */}
			{subscriptionTier !== "enterprise" && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="relative overflow-hidden rounded-xl border border-[#6D5CFF]/30 bg-gradient-to-r from-[#6D5CFF]/10 via-[#111827] to-[#A78BFA]/10 p-6"
				>
					<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[#6D5CFF]/20 blur-[60px]" />
					<div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="text-lg font-semibold text-white">
								{subscriptionTier === "free" && "Unlock AI-Powered Insurance Tools"}
								{subscriptionTier === "trial" && "Your Trial is Active"}
								{subscriptionTier === "pro" && "Upgrade to Pro+ for More Power"}
								{subscriptionTier === "pro_plus" && "Go Enterprise for Full Access"}
							</h3>
							<p className="mt-1 text-sm text-slate-400">
								{subscriptionTier === "free" && "Get Objection AI, Supplement Generator, and Negotiation Coach."}
								{subscriptionTier === "trial" && "Explore all Pro features before your trial ends."}
								{subscriptionTier === "pro" && "Add Supplement Generation and AI Negotiation coaching."}
								{subscriptionTier === "pro_plus" && "Lead Generator, Route Planner, and Roof Measurement AI."}
							</p>
						</div>
						<Link href="/settings/billing">
							<Button variant="primary" glow>
								{subscriptionTier === "trial" ? "Choose a Plan" : "Upgrade Now"}
							</Button>
						</Link>
					</div>
				</motion.div>
			)}

			{/* Quick Actions */}
			<div>
				<h2 className="mb-4 text-lg font-semibold text-white">AI Tools</h2>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{quickActions.map((action, index) => {
						const hasAccess = hasFeature(subscriptionTier, action.feature);
						return (
							<motion.div
								key={action.href}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: index * 0.05 }}
							>
								{hasAccess ? (
									<Link href={action.href}>
										<Card className="group h-full p-5 transition-all hover:border-[#6D5CFF]/50 hover:bg-[#6D5CFF]/5">
											<div className="flex items-start gap-4">
												<div className="rounded-lg bg-[#6D5CFF]/10 p-2.5 text-[#A78BFA] transition-colors group-hover:bg-[#6D5CFF]/20">
													{action.icon}
												</div>
												<div className="flex-1">
													<div className="flex items-center gap-2">
														<h3 className="font-semibold text-white">{action.title}</h3>
													</div>
													<p className="mt-1 text-sm text-slate-400">
														{action.description}
													</p>
												</div>
											</div>
										</Card>
									</Link>
								) : (
									<Card className="h-full p-5 opacity-60">
										<div className="flex items-start gap-4">
											<div className="rounded-lg bg-slate-700/50 p-2.5 text-slate-500">
												{action.icon}
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<h3 className="font-semibold text-slate-400">{action.title}</h3>
													<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getTierBadgeStyle(action.tier)}`}>
														{action.tier}
													</span>
												</div>
												<p className="mt-1 text-sm text-slate-500">
													{action.description}
												</p>
											</div>
										</div>
									</Card>
								)}
							</motion.div>
						);
					})}
				</div>
			</div>

			{/* Recent Activity */}
			<Card className="p-6">
				<h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
				<div className="space-y-4">
					{[
						{ action: "Supplement approved", detail: "State Farm - $4,250 recovered", time: "2 hours ago", type: "success" },
						{ action: "Storm alert detected", detail: "Hail event - 127 properties identified", time: "3 hours ago", type: "info" },
						{ action: "Negotiation won", detail: "O&P approved by Allstate", time: "Yesterday", type: "success" },
						{ action: "SMS response sent", detail: "Maria Garcia - Appointment booked", time: "Yesterday", type: "info" },
					].map((item, i) => (
						<div key={i} className="flex items-center gap-4 rounded-lg bg-slate-800/50 p-4">
							<div className={`h-2 w-2 rounded-full ${item.type === "success" ? "bg-emerald-400" : "bg-[#6D5CFF]"}`} />
							<div className="flex-1">
								<p className="text-sm font-medium text-white">{item.action}</p>
								<p className="text-xs text-slate-400">{item.detail}</p>
							</div>
							<span className="text-xs text-slate-500">{item.time}</span>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
