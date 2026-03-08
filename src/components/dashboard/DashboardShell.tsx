"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { getDaysRemaining, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface DashboardShellProps {
	children: ReactNode;
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
	tier?: SubscriptionTier;
	trialEnd?: string | null;
}

export function DashboardShell({
	children,
	user,
	subscriptionStatus,
	tier = "free",
	trialEnd,
}: DashboardShellProps) {
	// Calculate days until trial end
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;

	return (
		<div className="min-h-screen bg-[#0B0F1A]">
			{/* Sidebar */}
			<Sidebar 
				subscriptionTier={tier}
				daysUntilTrialEnd={daysUntilTrialEnd}
			/>

			{/* Main content */}
			<div className="pl-64">
				<TopNav 
					user={user} 
					subscriptionStatus={subscriptionStatus}
					tier={tier}
					trialEnd={trialEnd}
				/>
				<main className="min-h-[calc(100vh-4rem)] p-6">{children}</main>
			</div>
		</div>
	);
}
