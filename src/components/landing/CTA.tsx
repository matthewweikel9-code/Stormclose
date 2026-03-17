"use client";

import { motion } from "framer-motion";
import { useDemoModal } from "./DemoContext";

export function CTA() {
	const { openDemoModal } = useDemoModal();

	return (
		<section className="relative overflow-hidden border-t border-slate-800/30 bg-storm-z0 py-32">
			<div className="absolute inset-0">
				<div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-storm-purple/20 blur-[250px]" />
			</div>
			<div className="absolute inset-0 bg-gradient-to-b from-transparent via-storm-purple/5 to-transparent" />

			<div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 32 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.7 }}
				>
					<h2 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl" style={{ lineHeight: 1.1 }}>
						Stop chasing storms.{" "}
						<span className="bg-gradient-to-r from-storm-glow to-storm-purple bg-clip-text text-transparent">
							Start closing them.
						</span>
					</h2>

					<p className="mx-auto mt-8 max-w-xl text-lg text-slate-400">
						See how StormClose AI gives your roofing team the unfair advantage.
					</p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="mt-12"
					>
						<button
							onClick={openDemoModal}
							className="rounded-2xl bg-storm-purple px-12 py-5 text-lg font-bold text-white shadow-xl shadow-storm-purple/30 transition-all hover:bg-storm-purple-hover hover:shadow-2xl hover:shadow-storm-purple/40"
						>
							Request Demo
						</button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}
