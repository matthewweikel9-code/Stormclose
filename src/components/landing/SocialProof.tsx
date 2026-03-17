"use client";

import { motion } from "framer-motion";

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
						Trusted by roofing teams across 30+ states
					</p>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
						{["Apex Roofing", "Summit Restoration", "Heritage Exteriors", "Pinnacle Construction", "Stormproof Co"].map(
							(name, i) => (
								<motion.div
									key={name}
									initial={{ opacity: 0 }}
									whileInView={{ opacity: 1 }}
									viewport={{ once: true }}
									transition={{ delay: i * 0.08, duration: 0.5 }}
									className="text-xl font-bold tracking-tight text-slate-600/60"
								>
									{name}
								</motion.div>
							)
						)}
					</div>
				</motion.div>
			</div>
		</section>
	);
}
