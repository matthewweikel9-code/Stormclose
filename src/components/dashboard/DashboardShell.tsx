"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { getDaysRemaining, type SubscriptionTier } from "@/lib/subscriptions/tiers";
import type { UserRole } from "@/lib/auth/roles";

interface DashboardShellProps {
	children: ReactNode;
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
	tier?: SubscriptionTier;
	trialEnd?: string | null;
	userRole: UserRole;
}

export function DashboardShell({
	children,
	user,
	subscriptionStatus,
	tier = "free",
	trialEnd,
	userRole,
}: DashboardShellProps) {
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;

	return (
		<div className="min-h-screen bg-storm-bg">
			{/* Sidebar — 72px collapsed, expands on hover */}
			<Sidebar 
				subscriptionTier={tier}
				daysUntilTrialEnd={daysUntilTrialEnd}
				userRole={userRole}
			/>

			{/* Main content — offset for collapsed sidebar */}
			<div className="pl-[4.5rem] transition-all duration-300">
				<TopNav 
					user={user} 
					subscriptionStatus={subscriptionStatus}
					tier={tier}
					trialEnd={trialEnd}
				/>
				<main className="min-h-[calc(100vh-4rem)] p-6 animate-fade-in">
					{children}
				</main>
			</div>
		</div>
	);
}
