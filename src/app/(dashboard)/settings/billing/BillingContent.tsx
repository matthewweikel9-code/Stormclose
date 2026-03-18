"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Clock, CheckCircle, Zap, Crown, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
	free: ["Objection Handler AI", "Basic responses", "Community support"],
	trial: ["7-day free trial", "All Pro+ features", "Email support"],
	pro: ["Objection Handler AI", "Carrier Intelligence Database", "Lead Scoring AI", "Email support"],
	pro_plus: ["Everything in Pro", "AI Negotiation Coach", "SMS AI Responder", "Priority support"],
	enterprise: ["Everything in Pro+", "Supplement Generator AI", "Unlimited supplements", "Custom integrations", "Dedicated support"],
};

const TIER_ICON: Record<string, typeof Zap> = {
	free: Zap, trial: Clock, pro: Zap, pro_plus: Sparkles, enterprise: Crown,
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
				body: JSON.stringify({ tier: targetTier }),
			});
			const data = await res.json();
			if (data.url) window.location.href = data.url;
		} catch (error) {
			console.error("Checkout error:", error);
		} finally { setIsLoading(null); }
	};

	const handleManageSubscription = async () => {
		setIsLoading("manage");
		try {
			const res = await fetch("/api/stripe/portal", { method: "POST" });
			const data = await res.json();
			if (data.url) window.location.href = data.url;
		} catch (error) {
			console.error("Portal error:", error);
		} finally { setIsLoading(null); }
	};

	const TierIcon = TIER_ICON[tier] ?? Zap;

	return (
		<div className="max-w-3xl space-y-5">
			{/* Header */}
			<div>
				<h1 className="text-lg font-bold text-white">Billing & Subscription</h1>
				<p className="text-2xs text-storm-subtle mt-0.5">Manage your subscription plan and billing information</p>
			</div>

			{/* Current Plan Card */}
			<section className="storm-card-glow relative overflow-hidden border-storm-purple/20">
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
				<div className="p-5">
					<div className="flex items-start justify-between">
						<div>
							<div className="flex items-center gap-3 mb-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
									<TierIcon className="h-5 w-5 text-storm-glow" />
								</div>
								<div>
									<h2 className="text-sm font-semibold text-white">Current Plan</h2>
									<div className="flex items-center gap-2 mt-0.5">
										<Badge variant={tier === "enterprise" ? "warning" : tier === "pro_plus" || tier === "pro" ? "purple" : "default"}>
											{TIER_DISPLAY_NAMES[tier]}
										</Badge>
										{isOnTrial && (
											<Badge variant="warning">
												<Clock className="h-3 w-3 mr-1" />
												{daysRemaining} days left
											</Badge>
										)}
										{status === "active" && !isOnTrial && (
											<Badge variant="success">Active</Badge>
										)}
									</div>
								</div>
							</div>
						</div>
						{hasSubscription && (
							<button onClick={handleManageSubscription} disabled={isLoading === "manage"} className="button-secondary flex items-center gap-2 text-sm">
								{isLoading === "manage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
								{isLoading === "manage" ? "Loading..." : "Manage"}
							</button>
						)}
					</div>

					{/* Usage Stats */}
					<div className="grid gap-3 sm:grid-cols-2 mt-4">
						<div className="glass-subtle rounded-xl p-3.5">
							<p className="text-2xs text-storm-subtle uppercase tracking-wider font-medium">Plan Status</p>
							<p className="mt-1 text-lg font-bold text-white">
								{status === "active" ? "Active" : isOnTrial ? "Trial" : "Inactive"}
							</p>
						</div>
						<div className="glass-subtle rounded-xl p-3.5">
							<p className="text-2xs text-storm-subtle uppercase tracking-wider font-medium">Billing Period</p>
							<p className="mt-1 text-lg font-bold text-white">
								{tier === "free" ? "N/A" : "Monthly"}
							</p>
							{tier !== "free" && tier !== "trial" && (
								<p className="text-2xs text-storm-subtle mt-0.5">${TIER_PRICES[tier]}/month</p>
							)}
						</div>
					</div>

					{/* Current Features */}
					<div className="mt-4">
						<p className="text-2xs text-storm-subtle uppercase tracking-wider font-medium mb-2">Your Features</p>
						<ul className="grid gap-1.5 sm:grid-cols-2">
							{FEATURES_BY_TIER[tier].map((feature) => (
								<li key={feature} className="flex items-center gap-2 text-xs text-storm-muted">
									<CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
									{feature}
								</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			{/* Upgrade Options */}
			{tier !== "enterprise" && (
				<div>
					<h2 className="text-sm font-semibold text-white mb-3">
						{tier === "free" || tier === "trial" ? "Choose Your Plan" : "Upgrade Your Plan"}
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{/* Pro Plan */}
						{tier !== "pro" && tier !== "pro_plus" && (
							<div className="storm-card p-5">
								<div className="flex items-center justify-between mb-3">
									<div>
										<h3 className="text-sm font-semibold text-white">Pro</h3>
										<p className="text-storm-muted text-xs">
											<span className="text-xl font-bold text-white">${TIER_PRICES.pro}</span>/mo
										</p>
									</div>
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-purple/15">
										<Zap className="h-4 w-4 text-storm-glow" />
									</div>
								</div>
								<ul className="space-y-1.5 mb-4">
									{FEATURES_BY_TIER.pro.map((feature) => (
										<li key={feature} className="flex items-center gap-2 text-xs text-storm-muted">
											<CheckCircle className="h-3.5 w-3.5 text-storm-glow flex-shrink-0" />
											{feature}
										</li>
									))}
								</ul>
								<button onClick={() => handleUpgrade("pro")} disabled={isLoading === "pro"} className="button-primary w-full text-sm flex items-center justify-center gap-2">
									{isLoading === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
									{isLoading === "pro" ? "Loading..." : "Upgrade to Pro"}
								</button>
							</div>
						)}

						{/* Pro+ Plan */}
						{tier !== "pro_plus" && (
							<div className="storm-card-glow relative overflow-hidden border-storm-purple/30 p-5">
								<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
								<div className="flex items-center justify-between mb-3">
									<div>
										<h3 className="text-sm font-semibold text-white">Pro+</h3>
										<p className="text-storm-muted text-xs">
											<span className="text-xl font-bold text-white">${TIER_PRICES.pro_plus}</span>/mo
										</p>
									</div>
									<Badge variant="purple">Popular</Badge>
								</div>
								<ul className="space-y-1.5 mb-4">
									{FEATURES_BY_TIER.pro_plus.map((feature) => (
										<li key={feature} className="flex items-center gap-2 text-xs text-storm-muted">
											<CheckCircle className="h-3.5 w-3.5 text-storm-glow flex-shrink-0" />
											{feature}
										</li>
									))}
								</ul>
								<button onClick={() => handleUpgrade("pro_plus")} disabled={isLoading === "pro_plus"} className="button-primary w-full text-sm flex items-center justify-center gap-2">
									{isLoading === "pro_plus" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
									{isLoading === "pro_plus" ? "Loading..." : "Upgrade to Pro+"}
								</button>
							</div>
						)}

						{/* Enterprise Plan */}
						<div className="storm-card-glow relative overflow-hidden border-amber-500/30 p-5">
							<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
							<div className="flex items-center justify-between mb-3">
								<div>
									<h3 className="text-sm font-semibold text-white">Enterprise</h3>
									<p className="text-storm-muted text-xs">
										<span className="text-xl font-bold text-white">${TIER_PRICES.enterprise}</span>/mo
									</p>
								</div>
								<Badge variant="warning">Best Value</Badge>
							</div>
							<ul className="space-y-1.5 mb-4">
								{FEATURES_BY_TIER.enterprise.map((feature) => (
									<li key={feature} className="flex items-center gap-2 text-xs text-storm-muted">
										<CheckCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
										{feature}
									</li>
								))}
							</ul>
							<button
								onClick={() => handleUpgrade("enterprise")}
								disabled={isLoading === "enterprise"}
								className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
							>
								{isLoading === "enterprise" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
								{isLoading === "enterprise" ? "Loading..." : "Get Enterprise"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Account Info */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5">
					<h2 className="text-sm font-semibold text-white mb-3">Account Information</h2>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-xs text-storm-subtle">Email</span>
							<span className="text-xs text-white font-medium">{user.email || "—"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs text-storm-subtle">Account ID</span>
							<span className="font-mono text-2xs text-storm-subtle">{user.id.slice(0, 8)}...</span>
						</div>
					</div>
				</div>
			</section>

			{/* Back Link */}
			<Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-storm-glow hover:text-storm-purple transition-colors">
				<ArrowLeft className="h-3.5 w-3.5" />
				Back to Dashboard
			</Link>
		</div>
	);
}
