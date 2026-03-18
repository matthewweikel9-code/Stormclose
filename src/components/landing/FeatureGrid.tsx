"use client";

import { motion } from "framer-motion";

const features = [
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
		),
		title: "Documents Hub",
		description: "Your appointment workflow: generate reports, upload estimates, and export to JobNimbus for each roof from Storm Ops.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
			</svg>
		),
		title: "Team Leaderboards",
		description: "Performance tracking with doors knocked, appointments set, deals closed, and revenue per rep.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
		),
		title: "JobNimbus Sync",
		description: "Two-way CRM integration. Auto-export leads, sync contacts, jobs, and estimates with one click.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
		),
		title: "Objection Handler",
		description: "30+ proven scripts and AI-generated responses. Browse by category or generate custom rebuttals.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		),
		title: "Live GPS Tracking",
		description: "See your team in the field in real-time. Track locations, manage territories by ZIP code.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
			</svg>
		),
		title: "Revenue Hub",
		description: "Full-picture dashboard: pipeline value, hot leads, daily briefing, weather, and hail alerts at a glance.",
		span: 1,
	},
];

export function FeatureGrid() {
	return (
		<section id="features" className="relative border-t border-slate-800/30 bg-storm-z1 py-28">
			<div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-storm-purple/8 blur-[120px]" />

			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mb-16 text-center"
				>
					<span className="text-sm font-bold uppercase tracking-[0.2em] text-storm-glow">More Features</span>
					<h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
						Everything else you need
					</h2>
				</motion.div>

				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature, index) => (
						<motion.div
							key={feature.title}
							initial={{ opacity: 0, y: 16 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.4, delay: index * 0.05 }}
							className="group rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/30 to-slate-900/50 p-6 transition-all duration-300 hover:border-storm-purple/40 hover:shadow-lg hover:shadow-storm-purple/5"
						>
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-storm-purple/15 text-storm-glow transition-colors group-hover:bg-storm-purple/25">
								{feature.icon}
							</div>
							<h3 className="mb-2 text-lg font-bold text-white">{feature.title}</h3>
							<p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
