"use client";

import { ReactNode, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";
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
	const router = useRouter();
	const isTvMode = searchParams.get("tv") === "1";
	const errorForbidden = searchParams.get("error") === "forbidden";
	const [showForbiddenBanner, setShowForbiddenBanner] = useState(errorForbidden);

	useEffect(() => {
		if (errorForbidden) {
			setShowForbiddenBanner(true);
			router.replace("/dashboard", { scroll: false });
		}
	}, [errorForbidden, router]);

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
				{showForbiddenBanner && (
					<div className="mx-4 md:mx-6 mt-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 animate-fade-in">
						<div className="flex items-center gap-3">
							<ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0" />
							<div>
								<p className="text-sm font-medium text-white">Access denied</p>
								<p className="text-xs text-storm-muted">You don&apos;t have permission to view that page. Contact your team admin for access.</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Link
								href="/settings/billing"
								className="text-xs font-medium text-amber-400 hover:text-amber-300"
							>
								Upgrade
							</Link>
							<button
								onClick={() => setShowForbiddenBanner(false)}
								className="p-1 rounded hover:bg-storm-z2 text-storm-subtle hover:text-white transition-colors"
								aria-label="Dismiss"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				)}
				<main className="min-h-[calc(100vh-4rem)] p-4 md:p-6 animate-fade-in">
					{children}
				</main>
			</div>
		</div>
	);
}
