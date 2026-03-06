"use client";

import Link from "next/link";
import { getDaysRemaining, TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface TopNavProps {
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
	tier?: SubscriptionTier;
	reportsThisMonth?: number;
	trialEnd?: string | null;
}

export function TopNav({ user, subscriptionStatus, tier = "free", reportsThisMonth = 0, trialEnd }: TopNavProps) {
	const displayTier = TIER_DISPLAY_NAMES[tier] || "Free";
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;
	const isOnTrial = daysUntilTrialEnd !== null && daysUntilTrialEnd > 0;
	
	return (
		<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#1F2937] bg-[#0B0F1A]/80 px-6 backdrop-blur-xl">
			{/* Left side - Breadcrumb or search */}
			<div className="flex items-center gap-4">
				<div className="hidden items-center gap-2 rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-2 sm:flex">
					<svg
						className="h-4 w-4 text-slate-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search..."
						className="w-48 bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none"
					/>
					<kbd className="hidden rounded border border-[#1F2937] bg-[#0B0F1A] px-1.5 py-0.5 text-xs text-slate-500 lg:inline">
						⌘K
					</kbd>
				</div>
			</div>

			{/* Right side - User info */}
			<div className="flex items-center gap-4">
				{/* Trial countdown */}
				{isOnTrial && (
					<span className="hidden items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 sm:inline-flex">
						<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? "s" : ""} left in trial
					</span>
				)}

				{/* Subscription badge */}
				<span
					className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
						tier === "pro_plus"
							? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-400"
							: tier === "pro" || tier === "trial"
							? "bg-emerald-500/10 text-emerald-400"
							: "bg-slate-700/50 text-slate-400"
					}`}
				>
					{displayTier}
				</span>

				{/* Upgrade button (if not pro_plus) */}
				{tier !== "pro_plus" && (
					<Link
						href="/settings/billing"
						className="hidden rounded-lg bg-[#6D5CFF] px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-[#5B4AE8] sm:inline-flex"
					>
						{tier === "free" ? "Upgrade" : "Go Pro+"}
					</Link>
				)}

				{/* Notifications */}
				<button className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-[#1E293B] hover:text-white">
					<svg
						className="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#6D5CFF]" />
				</button>

				{/* User avatar */}
				<div className="flex items-center gap-3">
					<div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6D5CFF] to-[#A78BFA]" />
					<div className="hidden lg:block">
						<p className="text-sm font-medium text-white">
							{user?.email?.split("@")[0] || "User"}
						</p>
						<p className="text-xs text-slate-500">{user?.email || ""}</p>
					</div>
				</div>
			</div>
		</header>
	);
}
