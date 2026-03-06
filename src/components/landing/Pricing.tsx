"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const tiers = [
	{
		name: "Free Trial",
		price: "0",
		period: "7 days",
		description: "Try StormClose risk-free with full access to Pro features.",
		features: [
			"7-day full access trial",
			"Up to 5 AI reports",
			"Follow-up email generation",
			"Basic support",
		],
		cta: "Start Free Trial",
		href: "/signup",
		highlighted: false,
	},
	{
		name: "Pro",
		price: "99",
		period: "month",
		description: "Everything you need to streamline your roofing insurance workflow.",
		features: [
			"Unlimited AI reports",
			"Insurance email generation",
			"CSV uploads (Xactimate, JobNimbus)",
			"Follow-up builder",
			"Priority email support",
			"Analytics dashboard",
		],
		cta: "Get Started",
		href: "/signup",
		highlighted: true,
		badge: "Most Popular",
	},
	{
		name: "Pro+",
		price: "200",
		period: "month",
		description: "Advanced AI features for high-volume roofing operations.",
		features: [
			"Everything in Pro",
			"AI photo damage analysis",
			"Objection response AI",
			"Priority support",
			"Custom branding",
			"Team collaboration",
			"API access",
		],
		cta: "Upgrade to Pro+",
		href: "/signup",
		highlighted: false,
		badge: "Best Value",
	},
];

export function Pricing() {
	return (
		<section id="pricing" className="relative bg-[#0B0F1A] py-24">
			{/* Background */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-[#6D5CFF]/10 blur-[150px]" />
				<div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-[#A78BFA]/10 blur-[100px]" />
			</div>

			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				{/* Section header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="text-center"
				>
					<span className="text-sm font-semibold uppercase tracking-wider text-[#A78BFA]">
						Pricing
					</span>
					<h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
						Simple, transparent pricing
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
						Choose the plan that fits your business. Start with a free trial, upgrade anytime.
					</p>
				</motion.div>

				{/* Pricing cards */}
				<div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
					{tiers.map((tier, index) => (
						<motion.div
							key={tier.name}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
							className="relative"
						>
							<div
								className={`relative h-full overflow-hidden rounded-3xl border p-1 ${
									tier.highlighted
										? "border-[#6D5CFF]/50 bg-gradient-to-b from-[#6D5CFF]/20 to-slate-900/80"
										: "border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50"
								}`}
							>
								{/* Glow effect for highlighted */}
								{tier.highlighted && (
									<>
										<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[#6D5CFF]/30 blur-[60px]" />
										<div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#A78BFA]/20 blur-[60px]" />
									</>
								)}

								<div className="relative h-full rounded-[22px] bg-[#0B0F1A] p-6 flex flex-col">
									{/* Badge */}
									{tier.badge && (
										<div className={`mb-4 inline-flex self-start items-center rounded-full px-3 py-1 text-xs font-semibold ${
											tier.highlighted
												? "bg-[#6D5CFF]/20 text-[#A78BFA]"
												: "bg-amber-500/10 text-amber-400"
										}`}>
											{tier.badge}
										</div>
									)}

									{/* Plan name */}
									<h3 className="text-xl font-bold text-white">{tier.name}</h3>

									{/* Price */}
									<div className="mt-4 flex items-baseline gap-1">
										<span className="text-4xl font-bold text-white">${tier.price}</span>
										<span className="text-sm text-slate-400">/ {tier.period}</span>
									</div>

									<p className="mt-4 text-sm text-slate-400">{tier.description}</p>

									{/* CTA Button */}
									<Link
										href={tier.href}
										className={`mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
											tier.highlighted
												? "bg-[#6D5CFF] text-white hover:bg-[#5B4AE8] hover:shadow-xl hover:shadow-[#6D5CFF]/25"
												: "bg-slate-800 text-white hover:bg-slate-700"
										}`}
									>
										{tier.cta}
									</Link>

									{/* Features list */}
									<div className="mt-6 flex-1 border-t border-slate-800 pt-6">
										<ul className="space-y-3">
											{tier.features.map((feature, featureIndex) => (
												<li key={featureIndex} className="flex items-start gap-3">
													<svg
														className={`h-5 w-5 flex-shrink-0 ${
															tier.highlighted ? "text-[#6D5CFF]" : "text-slate-500"
														}`}
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M5 13l4 4L19 7"
														/>
													</svg>
													<span className="text-sm text-slate-300">{feature}</span>
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						</motion.div>
					))}
				</div>

				{/* Trust badge */}
				<motion.div
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.4 }}
					className="mt-12 flex flex-col items-center gap-4 text-center"
				>
					<div className="flex items-center gap-2">
						<svg
							className="h-5 w-5 text-green-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
							/>
						</svg>
						<span className="text-sm text-slate-400">
							256-bit SSL encryption • Cancel anytime
						</span>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
