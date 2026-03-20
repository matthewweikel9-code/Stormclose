"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function SocialProof() {
	return (
		<section className="relative border-t border-slate-800/30 bg-storm-z0 py-16">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="text-center"
				>
					<p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
						Built for storm roofing teams
					</p>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
						{[
							{ label: "Stripe billing", desc: "Secure subscriptions" },
							{ label: "Supabase", desc: "Enterprise data" },
							{ label: "JobNimbus", desc: "CRM sync" },
							{ label: "SOC 2 ready", desc: "Security-first" },
						].map((item, i) => (
							<motion.div
								key={item.label}
								initial={{ opacity: 0 }}
								whileInView={{ opacity: 1 }}
								viewport={{ once: true }}
								transition={{ delay: i * 0.08, duration: 0.5 }}
								className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-3 text-center"
							>
								<span className="block text-sm font-semibold text-slate-300">{item.label}</span>
								<span className="block text-xs text-slate-500">{item.desc}</span>
							</motion.div>
						))}
					</div>
					<p className="mt-6 text-xs text-slate-500">
						Have a success story?{" "}
						<Link href="/contact" className="text-storm-glow hover:text-storm-purple">
							Share it with us
						</Link>
					</p>
				</motion.div>
			</div>
		</section>
	);
}
