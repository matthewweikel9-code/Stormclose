"use client";

import { useState } from "react";
import Link from "next/link";
import { 
	TIER_DISPLAY_NAMES, 
	TIER_PRICES, 
	getDaysRemaining, 
	type SubscriptionTier 
} from "@/lib/subscriptions/tiers";

interface BillingContentProps {
	user: { id: string; email?: string | null };
	subscriptionData: {
		tier: SubscriptionTier;
		status: string;
		trialEnd?: string | null;
		hasStripeCustomer: boolean;
		hasSubscription: boolean;
	};
}

const FEATURES_BY_TIER: Record<SubscriptionTier, string[]> = {
	free: [
		"Objection Handler AI",
		"Basic responses",
		"Community support"
	],
	trial: [
		"7-day free trial",
		"All Pro+ features",
		"Email support"
	],
	pro: [
		"Objection Handler AI",
		"Carrier Intelligence Database",
		"Lead Scoring AI",
		"Email support"
	],
	pro_plus: [
		"Everything in Pro",
		"AI Negotiation Coach",
		"SMS AI Responder",
		"Priority support"
	],
	enterprise: [
		"Everything in Pro+",
		"Supplement Generator AI",
		"Unlimited supplements",
		"Custom integrations",
		"Dedicated support"
	]
};

export function BillingContent({ user, subscriptionData }: BillingContentProps) {
	const [isLoading, setIsLoading] = useState<string | null>(null);
	const { tier, status, trialEnd, hasSubscription } = subscriptionData;
	
	const daysRemaining = trialEnd ? getDaysRemaining(trialEnd) : 0;
	const isOnTrial = tier === "trial" || (daysRemaining > 0 && status !== "active");
	
	const handleUpgrade = async (targetTier: "pro" | "pro_plus" | "enterprise") => {
		setIsLoading(targetTier);
		try {
			const res = await fetch("/api/stripe/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tier: targetTier })
			});
			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (error) {
			console.error("Checkout error:", error);
		} finally {
			setIsLoading(null);
		}
	};

	const handleManageSubscription = async () => {
		setIsLoading("manage");
		try {
			const res = await fetch("/api/stripe/portal", { method: "POST" });
			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (error) {
			console.error("Portal error:", error);
		} finally {
			setIsLoading(null);
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
				<p className="mt-1 text-slate-400">
					Manage your subscription plan and billing information
				</p>
			</div>

			{/* Current Plan Card */}
			<div className="storm-card p-6">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-lg font-semibold text-white">Current Plan</h2>
						<div className="mt-2 flex items-center gap-3">
							<span className={`rounded-full px-3 py-1 text-sm font-semibold ${
								tier === "pro_plus" 
									? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400"
									: tier === "pro"
									? "bg-storm-purple/20 text-storm-glow"
									: "bg-slate-700/50 text-slate-400"
							}`}>
								{TIER_DISPLAY_NAMES[tier]}
							</span>
							{isOnTrial && (
								<span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
									<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									{daysRemaining} days left in trial
								</span>
							)}
							{status === "active" && !isOnTrial && (
								<span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
									<svg className="h-3 w-3" fill="currentColor" viewBox="0 0 8 8">
										<circle cx="4" cy="4" r="3" />
									</svg>
									Active
								</span>
							)}
						</div>
					</div>
					{hasSubscription && (
						<button
							onClick={handleManageSubscription}
							disabled={isLoading === "manage"}
							className="rounded-lg border border-storm-border bg-storm-z0 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-storm-z2 hover:text-white disabled:opacity-50"
						>
							{isLoading === "manage" ? "Loading..." : "Manage Subscription"}
						</button>
					)}
				</div>

				{/* Usage */}
				<div className="mt-6 grid gap-4 sm:grid-cols-2">
					<div className="rounded-lg bg-storm-z0 p-4">
						<p className="text-sm text-slate-400">Plan Status</p>
						<p className="mt-1 text-lg font-semibold text-white">
							{status === "active" ? "Active" : isOnTrial ? "Trial" : "Inactive"}
						</p>
					</div>
					<div className="rounded-lg bg-storm-z0 p-4">
						<p className="text-sm text-slate-400">Billing Period</p>
						<p className="mt-1 text-lg font-semibold text-white">
							{tier === "free" ? "N/A" : "Monthly"}
						</p>
						{tier !== "free" && tier !== "trial" && (
							<p className="mt-1 text-sm text-slate-500">
								${TIER_PRICES[tier]}/month
							</p>
						)}
					</div>
				</div>

				{/* Current Features */}
				<div className="mt-6">
					<p className="text-sm font-medium text-slate-400">Your Features</p>
					<ul className="mt-2 grid gap-2 sm:grid-cols-2">
						{FEATURES_BY_TIER[tier].map((feature) => (
							<li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
								<svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
								{feature}
							</li>
						))}
					</ul>
				</div>
			</div>

			{/* Upgrade Options */}
			{tier !== "enterprise" && (
				<div>
					<h2 className="text-lg font-semibold text-white">
						{tier === "free" || tier === "trial" ? "Choose Your Plan" : "Upgrade Your Plan"}
					</h2>
					<div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{/* Pro Plan */}
						{tier !== "pro" && tier !== "pro_plus" && (
							<div className="storm-card p-6">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-semibold text-white">Pro</h3>
										<p className="text-slate-400">
											<span className="text-2xl font-bold text-white">${TIER_PRICES.pro}</span>
											/month
										</p>
									</div>
								</div>
								<ul className="mt-4 space-y-2">
									{FEATURES_BY_TIER.pro.map((feature) => (
										<li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
											<svg className="h-4 w-4 text-storm-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
											{feature}
										</li>
									))}
								</ul>
								<button
									onClick={() => handleUpgrade("pro")}
									disabled={isLoading === "pro"}
									className="mt-6 w-full rounded-lg bg-storm-purple py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple-hover disabled:opacity-50"
								>
									{isLoading === "pro" ? "Loading..." : "Upgrade to Pro"}
								</button>
							</div>
						)}

						{/* Pro+ Plan */}
						{tier !== "pro_plus" && (
							<div className="rounded-xl border border-storm-purple/30 bg-gradient-to-b from-storm-purple/5 to-transparent p-6">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-semibold text-white">Pro+</h3>
										<p className="text-slate-400">
											<span className="text-2xl font-bold text-white">${TIER_PRICES.pro_plus}</span>
											/month
										</p>
									</div>
									<span className="rounded-full bg-storm-purple/20 px-3 py-1 text-xs font-semibold text-storm-glow">
										Popular
									</span>
								</div>
								<ul className="mt-4 space-y-2">
									{FEATURES_BY_TIER.pro_plus.map((feature) => (
										<li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
											<svg className="h-4 w-4 text-storm-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
											{feature}
										</li>
									))}
								</ul>
								<button
									onClick={() => handleUpgrade("pro_plus")}
									disabled={isLoading === "pro_plus"}
									className="mt-6 w-full rounded-lg bg-storm-purple py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple-hover disabled:opacity-50"
								>
									{isLoading === "pro_plus" ? "Loading..." : "Upgrade to Pro+"}
								</button>
							</div>
						)}

						{/* Enterprise Plan */}
						<div className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent p-6">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-lg font-semibold text-white">Enterprise</h3>
									<p className="text-slate-400">
										<span className="text-2xl font-bold text-white">${TIER_PRICES.enterprise}</span>
										/month
									</p>
								</div>
								<span className="rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
									Best Value
								</span>
							</div>
							<ul className="mt-4 space-y-2">
								{FEATURES_BY_TIER.enterprise.map((feature) => (
									<li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
										<svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										{feature}
									</li>
								))}
							</ul>
							<button
								onClick={() => handleUpgrade("enterprise")}
								disabled={isLoading === "enterprise"}
								className="mt-6 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{isLoading === "enterprise" ? "Loading..." : "Get Enterprise"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Account Info */}
			<div className="storm-card p-6">
				<h2 className="text-lg font-semibold text-white">Account Information</h2>
				<div className="mt-4 space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-sm text-slate-400">Email</span>
						<span className="text-sm text-white">{user.email || "—"}</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-slate-400">Account ID</span>
						<span className="font-mono text-xs text-slate-500">{user.id.slice(0, 8)}...</span>
					</div>
				</div>
			</div>

			{/* Back Link */}
			<div>
				<Link
					href="/dashboard"
					className="text-sm text-storm-glow hover:text-storm-purple"
				>
					← Back to Dashboard
				</Link>
			</div>
		</div>
	);
}
