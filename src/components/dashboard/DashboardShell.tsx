"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { getDaysRemaining, TIER_CONFIG, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface DashboardShellProps {
	children: ReactNode;
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
	tier?: SubscriptionTier;
	reportsThisMonth?: number;
	trialEnd?: string | null;
}

export function DashboardShell({
	children,
	user,
	subscriptionStatus,
	tier = "free",
	reportsThisMonth = 0,
	trialEnd,
}: DashboardShellProps) {
	// Calculate days until trial end
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;
	
	// Calculate reports remaining for free tier
	const tierConfig = TIER_CONFIG[tier];
	const reportsRemaining = tierConfig.reportsPerMonth === "unlimited" 
		? null 
		: Math.max(0, tierConfig.reportsPerMonth - reportsThisMonth);

	return (
		<div className="min-h-screen bg-[#0B0F1A]">
			{/* Sidebar */}
			<Sidebar 
				subscriptionTier={tier}
				daysUntilTrialEnd={daysUntilTrialEnd}
				reportsRemaining={reportsRemaining}
			/>

			{/* Main content */}
			<div className="pl-64">
				<TopNav 
					user={user} 
					subscriptionStatus={subscriptionStatus}
					tier={tier}
					reportsThisMonth={reportsThisMonth}
					trialEnd={trialEnd}
				/>
				<main className="min-h-[calc(100vh-4rem)] p-6">{children}</main>
			</div>
		</div>
	);
}
