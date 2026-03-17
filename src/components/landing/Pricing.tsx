"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const tiers = [
	{
		name: "Free",
		price: "0",
		period: "forever",
		description: "Get started with core objection handling.",
		features: [
			"Objection Handler AI",
			"30+ proven scripts",
			"AI-generated rebuttals",
			"Community support",
		],
		cta: "Start Free",
		href: "/signup",
		highlighted: false,
	},
	{
		name: "Pro",
		price: "399",
		period: "month",
		description: "Essential insurance intelligence for growing teams.",
		features: [
			"Everything in Free",
			"Carrier Intelligence Database",
			"AI Assistant (GPT-4o)",
			"Storm report generation",
			"Deal Desk & Revenue Hub",
			"Email support",
		],
		cta: "Get Pro",
		href: "/subscribe?tier=pro",
		highlighted: true,
		badge: "Most Popular",
	},
	{
		name: "Enterprise",
		price: "799",
		period: "month",
		description: "Full platform with Storm Ops, Referral Engine, and team tools.",
		features: [
			"Everything in Pro",
			"Storm Ops command center",
			"Live hail & wind monitoring",
			"Referral Engine",
			"Team leaderboards & GPS",
			"JobNimbus integration",
			"Dedicated support",
		],
		cta: "Get Enterprise",
		href: "/subscribe?tier=enterprise",
		highlighted: false,
		badge: "Full Platform",
	},
];

export function Pricing() {
	return (
		<section id="pricing" className="relative border-t border-slate-800/30 bg-storm-z1 py-20">
			<div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-storm-purple/8 blur-[150px]" />
			<div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-storm-glow/8 blur-[120px]" />

			<div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mb-12 text-center"
				>
					<span className="text-sm font-bold uppercase tracking-[0.2em] text-storm-glow">Pricing</span>
					<h2 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">
						Plans that scale with your team
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
						Start free. Upgrade when you need more power.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{tiers.map((tier, index) => (
						<motion.div
							key={tier.name}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: index * 0.08 }}
						>
							<div
								className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 ${
									tier.highlighted
										? "border-storm-purple/60 shadow-xl shadow-storm-purple/15"
										: "border-slate-700/50"
								}`}
							>
								{tier.highlighted && (
									<div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-storm-purple/20 blur-[50px]" />
								)}
								<div className="relative flex flex-1 flex-col p-5">
									{tier.badge && (
										<div
											className={`mb-3 inline-flex self-start rounded-full px-3 py-1 text-xs font-bold ${
												tier.highlighted ? "bg-storm-purple/25 text-storm-glow" : "bg-amber-500/15 text-amber-400"
											}`}
										>
											{tier.badge}
										</div>
									)}
									<h3 className="text-xl font-bold text-white">{tier.name}</h3>
									<div className="mt-3 flex items-baseline gap-1">
										<span className="text-3xl font-extrabold text-white">${tier.price}</span>
										<span className="text-sm text-slate-400">/ {tier.period}</span>
									</div>
									<p className="mt-2 text-sm text-slate-400">{tier.description}</p>

									<Link
										href={tier.href}
										className={`mt-5 block w-full rounded-xl py-3 text-center text-sm font-bold transition-all ${
											tier.highlighted
												? "bg-storm-purple text-white shadow-lg shadow-storm-purple/25 hover:bg-storm-purple-hover"
												: "bg-slate-800 text-white hover:bg-slate-700"
										}`}
									>
										{tier.cta}
									</Link>

									<div className="mt-5 flex-1 border-t border-slate-800 pt-5">
										<ul className="space-y-2.5">
											{tier.features.map((feature, i) => (
												<li key={i} className="flex items-start gap-2">
													<svg
														className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tier.highlighted ? "text-storm-purple" : "text-slate-600"}`}
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
			</div>
		</section>
	);
}
