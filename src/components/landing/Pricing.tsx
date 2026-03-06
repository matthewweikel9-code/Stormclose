"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const features = [
	"Unlimited AI reports",
	"Insurance email generation",
	"CSV uploads (Xactimate, JobNimbus)",
	"Priority support",
	"Custom branding",
	"Team collaboration",
	"Analytics dashboard",
	"API access",
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
						One plan with everything you need. No hidden fees, no complicated tiers.
					</p>
				</motion.div>

				{/* Pricing card */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.2 }}
					className="mx-auto mt-16 max-w-lg"
				>
					<div className="relative overflow-hidden rounded-3xl border border-[#6D5CFF]/30 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-1">
						{/* Glow effect */}
						<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[#6D5CFF]/30 blur-[60px]" />
						<div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#A78BFA]/20 blur-[60px]" />

						<div className="relative rounded-[22px] bg-[#0B0F1A] p-8">
							{/* Badge */}
							<div className="mb-6 inline-flex items-center rounded-full bg-[#6D5CFF]/10 px-3 py-1 text-sm font-medium text-[#A78BFA]">
								Most Popular
							</div>

							{/* Plan name */}
							<h3 className="text-2xl font-bold text-white">StormClose Pro</h3>

							{/* Price */}
							<div className="mt-4 flex items-baseline gap-2">
								<span className="text-5xl font-bold text-white">$49</span>
								<span className="text-lg text-slate-400">/ month</span>
							</div>

							<p className="mt-4 text-slate-400">
								Everything you need to streamline your roofing insurance workflow.
							</p>

							{/* CTA Button */}
							<Link
								href="/signup"
								className="mt-8 block w-full rounded-xl bg-[#6D5CFF] py-4 text-center text-base font-semibold text-white transition-all hover:bg-[#5B4AE8] hover:shadow-xl hover:shadow-[#6D5CFF]/25"
							>
								Start Free Trial
							</Link>

							<p className="mt-4 text-center text-sm text-slate-500">
								14-day free trial • No credit card required
							</p>

							{/* Features list */}
							<div className="mt-8 border-t border-slate-800 pt-8">
								<p className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
									What&apos;s included
								</p>
								<ul className="space-y-4">
									{features.map((feature, index) => (
										<li key={index} className="flex items-center gap-3">
											<svg
												className="h-5 w-5 flex-shrink-0 text-[#6D5CFF]"
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
											<span className="text-slate-300">{feature}</span>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				</motion.div>

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
							256-bit SSL encryption • SOC 2 compliant
						</span>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
