"use client";

import { motion } from "framer-motion";

const steps = [
	{
		number: "01",
		title: "Storm Detected",
		description: "StormClose monitors live hail and wind data across your territories. When severe weather hits, you know immediately.",
		visual: (
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
					<svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<div>
					<div className="text-sm font-bold text-red-400">Severe Storm</div>
					<div className="text-xs text-slate-500">2.5&quot; hail detected in Dallas, TX</div>
				</div>
			</div>
		),
	},
	{
		number: "02",
		title: "Deploy Teams",
		description: "Create missions, assign routes, and send your team to the highest-impact properties. AI identifies the best neighborhoods.",
		visual: (
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-storm-purple/20">
					<svg className="h-5 w-5 text-storm-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					</svg>
				</div>
				<div>
					<div className="text-sm font-bold text-storm-glow">Mission Created</div>
					<div className="text-xs text-slate-500">12 stops assigned to Team A</div>
				</div>
			</div>
		),
	},
	{
		number: "03",
		title: "Close Deals",
		description: "Generate AI reports, handle objections, negotiate with carriers, and track every closed deal back to its source.",
		visual: (
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
					<svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<div className="text-sm font-bold text-emerald-400">Deal Closed</div>
					<div className="text-xs text-slate-500">$18,400 claim approved</div>
				</div>
			</div>
		),
	},
];

export function HowItWorks() {
	return (
		<section id="how-it-works" className="relative border-t border-slate-800/30 bg-storm-z0 py-28">
			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mb-20 text-center"
				>
					<span className="text-sm font-bold uppercase tracking-[0.2em] text-storm-glow">How It Works</span>
					<h2 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">
						From storm to closed deal
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
						Three steps. One platform. Every dollar tracked.
					</p>
				</motion.div>

				<div className="relative grid gap-8 lg:grid-cols-3">
					{/* Connector line */}
					<div className="absolute left-0 right-0 top-[60px] hidden h-px bg-gradient-to-r from-red-500/40 via-storm-purple/40 to-emerald-500/40 lg:block" />

					{steps.map((step, i) => (
						<motion.div
							key={step.number}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: i * 0.12 }}
							className="relative"
						>
							<div className="mb-8 flex items-center gap-4">
								<div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-slate-700 bg-storm-z1 text-2xl font-extrabold text-storm-glow shadow-lg">
									{step.number}
								</div>
								{i < steps.length - 1 && (
									<div className="hidden h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent lg:block" />
								)}
							</div>
							<h3 className="mb-3 text-2xl font-bold text-white">{step.title}</h3>
							<p className="mb-6 text-slate-400 leading-relaxed">{step.description}</p>
							<div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
								{step.visual}
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
