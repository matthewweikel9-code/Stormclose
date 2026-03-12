"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const tiers = [
	{
		name: "Free",
		price: "0",
		period: "forever",
		description: "Try StormClose AI",
		features: [
			"Objection Handler AI",
			"Basic responses",
			"Community support",
		],
		tier: null,
		highlighted: false,
	},
	{
		name: "Pro",
		price: "99",
		period: "month",
		description: "Essential insurance tools",
		features: [
			"Everything in Free",
			"Carrier Intelligence Database",
			"Lead Scoring AI",
			"Email support",
		],
		tier: "pro",
		highlighted: false,
	},
	{
		name: "Pro+",
		price: "199",
		period: "month",
		description: "Advanced negotiation tools",
		features: [
			"Everything in Pro",
			"AI Negotiation Coach",
			"SMS AI Responder",
			"Priority support",
		],
		tier: "pro_plus",
		highlighted: true,
		badge: "Most Popular",
	},
	{
		name: "Enterprise",
		price: "499",
		period: "month",
		description: "Complete insurance intelligence",
		features: [
			"Everything in Pro+",
			"Supplement Generator AI",
			"Unlimited supplements",
			"Custom integrations",
			"Dedicated support",
		],
		tier: "enterprise",
		highlighted: false,
		badge: "Best Value",
	},
];

export function PricingClient() {
	const [isLoading, setIsLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextPath = searchParams.get("next") || "/dashboard/report";

	async function handleCheckout(tier: string | null) {
		if (!tier) {
			router.push("/signup");
			return;
		}

		setIsLoading(tier);
		setError(null);

		try {
			const response = await fetch("/api/stripe/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tier }),
			});

			if (response.status === 401) {
				router.push(`/login?next=${encodeURIComponent(nextPath)}`);
				return;
			}

			const data = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

			if (!response.ok || !data?.url) {
				throw new Error(data?.error || "Unable to start checkout.");
			}

			window.location.href = data.url;
		} catch (checkoutError) {
			const message = checkoutError instanceof Error ? checkoutError.message : "Something went wrong.";
			setError(message);
			setIsLoading(null);
		}
	}

	return (
		<main className="min-h-screen bg-storm-bg px-4 py-16">
			<div className="mx-auto max-w-5xl">
				<div className="text-center mb-12">
					<h1 className="text-3xl font-bold text-white sm:text-4xl">Choose Your Plan</h1>
					<p className="mt-4 text-lg text-slate-400">
						Start with a free trial, upgrade when you&apos;re ready.
					</p>
				</div>

				{error && (
					<div className="mb-8 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-center">
						<p className="text-sm text-red-400">{error}</p>
					</div>
				)}

				<div className="grid gap-6 lg:grid-cols-3">
					{tiers.map((tierOption) => (
						<div
							key={tierOption.name}
							className={`relative rounded-2xl border p-6 ${
								tierOption.highlighted
									? "border-storm-purple/50 bg-gradient-to-b from-storm-purple/10 to-transparent"
									: "border-slate-700/50 bg-slate-800/30"
							}`}
						>
							{tierOption.badge && (
								<div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold ${
									tierOption.highlighted
										? "bg-storm-purple text-white"
										: "bg-amber-500/20 text-amber-400"
								}`}>
									{tierOption.badge}
								</div>
							)}

							<div className="pt-2">
								<h3 className="text-xl font-semibold text-white">{tierOption.name}</h3>
								<div className="mt-4 flex items-baseline gap-1">
									<span className="text-4xl font-bold text-white">${tierOption.price}</span>
									<span className="text-sm text-slate-400">/ {tierOption.period}</span>
								</div>
								<p className="mt-2 text-sm text-slate-400">{tierOption.description}</p>

								<button
									onClick={() => handleCheckout(tierOption.tier)}
									disabled={isLoading !== null}
									className={`mt-6 w-full rounded-lg py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
										tierOption.highlighted
											? "bg-storm-purple text-white hover:bg-storm-purple-hover"
											: "bg-slate-700 text-white hover:bg-slate-600"
									}`}
								>
									{isLoading === tierOption.tier
										? "Redirecting..."
										: tierOption.tier
										? `Get ${tierOption.name}`
										: "Start Free Trial"}
								</button>

								<ul className="mt-6 space-y-3">
									{tierOption.features.map((feature, index) => (
										<li key={index} className="flex items-center gap-2 text-sm text-slate-300">
											<svg
												className={`h-4 w-4 ${tierOption.highlighted ? "text-storm-purple" : "text-slate-500"}`}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
											{feature}
										</li>
									))}
								</ul>
							</div>
						</div>
					))}
				</div>

				<div className="mt-12 text-center">
					<Link href="/" className="text-sm text-storm-glow hover:text-storm-purple">
						← Back to Home
					</Link>
				</div>
			</div>
		</main>
	);
}
