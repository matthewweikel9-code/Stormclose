"use client";

import { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
	const daysUntilTrialEnd = trialEnd ? getDaysRemaining(trialEnd) : null;
	const searchParams = useSearchParams();
	const isTvMode = searchParams.get("tv") === "1";

	if (isTvMode) {
		return (
			<div className="min-h-screen bg-storm-bg">
				<main className="min-h-screen animate-fade-in">
					{children}
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-storm-bg">
			<Sidebar 
				subscriptionTier={tier}
				daysUntilTrialEnd={daysUntilTrialEnd}
			/>

			<div className="pl-0 md:pl-[4.5rem] transition-all duration-300">
				<TopNav 
					user={user} 
					subscriptionStatus={subscriptionStatus}
					tier={tier}
					trialEnd={trialEnd}
				/>
				<main className="min-h-[calc(100vh-4rem)] p-4 md:p-6 animate-fade-in">
					{children}
				</main>
			</div>
		</div>
	);
}
