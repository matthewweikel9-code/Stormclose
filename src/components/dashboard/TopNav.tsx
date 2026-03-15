"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getDaysRemaining, TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface TopNavProps {
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
	tier?: SubscriptionTier;
	trialEnd?: string | null;
}

const breadcrumbLabels: Record<string, string> = {
	"/dashboard": "Dashboard",
	"/dashboard/storms": "Storms",
	"/dashboard/missions": "Missions",
	"/dashboard/mission-control": "Mission Control",
	"/dashboard/ai-studio": "AI Studio",
	"/dashboard/documents": "Documents",
	"/dashboard/exports": "Exports",
	"/dashboard/team": "Team",
	"/settings": "Settings",
	"/settings/billing": "Settings",
};

export function TopNav({ user, subscriptionStatus, tier = "free", trialEnd }: TopNavProps) {
	const pathname = usePathname();
	const displayTier = TIER_DISPLAY_NAMES[tier] || "Free";
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;
	const isOnTrial = daysUntilTrialEnd !== null && daysUntilTrialEnd > 0;

	// Derive breadcrumb from path
	const currentPage = breadcrumbLabels[pathname] || pathname.split("/").pop()?.replace(/-/g, " ") || "Dashboard";

	return (
		<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-storm-border bg-storm-bg/70 px-6 backdrop-blur-xl">
			{/* Left — Breadcrumb + Search */}
			<div className="flex items-center gap-4">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 text-sm">
					<span className="text-storm-subtle">StormClose</span>
					<svg className="h-3.5 w-3.5 text-storm-subtle/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
					<span className="font-medium text-white capitalize">{currentPage}</span>
				</div>

				{/* Search */}
				<div className="hidden items-center gap-2 rounded-xl border border-storm-border bg-storm-z1 px-3 py-2 transition-all duration-200 hover:border-storm-border-light focus-within:border-storm-purple/50 focus-within:ring-1 focus-within:ring-storm-purple/20 sm:flex">
					<svg className="h-4 w-4 text-storm-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Search..."
						className="w-48 bg-transparent text-sm text-slate-300 placeholder-storm-subtle outline-none"
					/>
					<kbd className="hidden rounded-md border border-storm-border bg-storm-z0 px-1.5 py-0.5 text-2xs text-storm-subtle font-mono lg:inline">
						⌘K
					</kbd>
				</div>
			</div>

			{/* Right — Status + User */}
			<div className="flex items-center gap-3">
				{/* Connection indicator */}
				<div className="hidden items-center gap-1.5 sm:flex">
					<span className="status-dot-live" />
					<span className="text-2xs text-storm-subtle">Connected</span>
				</div>

				{/* Divider */}
				<div className="hidden h-5 w-px bg-storm-border sm:block" />

				{/* Trial countdown */}
				{isOnTrial && (
					<Badge variant="warning" className="hidden sm:inline-flex">
						<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{daysUntilTrialEnd}d left
					</Badge>
				)}

				{/* Subscription badge */}
				<Badge
					variant={
						tier === "enterprise" ? "success" :
						tier === "pro_plus" ? "warning" :
						tier === "pro" || tier === "trial" ? "purple" :
						"default"
					}
					className="hidden sm:inline-flex"
				>
					{displayTier}
				</Badge>

				{/* Upgrade button */}
				{tier !== "pro_plus" && tier !== "enterprise" && (
					<Link
						href="/settings/billing"
						className="hidden sm:inline-flex items-center rounded-xl bg-storm-purple px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-storm-purple-hover hover:shadow-glow-sm"
					>
						{tier === "free" ? "Upgrade" : "Go Pro+"}
					</Link>
				)}

				{/* Notifications */}
				<button className="relative rounded-xl p-2 text-storm-subtle transition-all duration-200 hover:bg-storm-z2 hover:text-white">
					<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-storm-purple shadow-[0_0_6px_rgba(109,92,255,0.6)]" />
				</button>

				{/* Divider */}
				<div className="h-5 w-px bg-storm-border" />

				{/* User avatar */}
				<div className="flex items-center gap-3">
					<div className="h-8 w-8 rounded-xl bg-gradient-to-br from-storm-purple to-storm-glow shadow-inner-glow" />
					<div className="hidden lg:block">
						<p className="text-sm font-medium text-white leading-none">
							{user?.email?.split("@")[0] || "User"}
						</p>
						<p className="text-2xs text-storm-subtle mt-0.5">{user?.email || ""}</p>
					</div>
				</div>
			</div>
		</header>
	);
}
