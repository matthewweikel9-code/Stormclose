"use client";

import { motion } from "framer-motion";

const features = [
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
		),
		title: "Supplement Generator AI",
		description: "Upload adjuster estimates. AI identifies missing line items and generates professional supplement requests.",
		span: 2,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
			</svg>
		),
		title: "AI Negotiation Coach",
		description: "Real-time coaching during adjuster calls. State-specific O&P arguments and line-item justifications.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
			</svg>
		),
		title: "Carrier Intelligence",
		description: "Approval rates, preferred adjusters, and negotiation patterns for every major carrier.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		),
		title: "Lead Generator + Route Planner",
		description: "Search any area for property data. Plan optimized door-knocking routes with one-click navigation.",
		span: 2,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		),
		title: "Live Roof Measurement AI",
		description: "Instant satellite measurements. Square footage, pitch analysis, panel counts in seconds.",
		span: 1,
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
		),
		title: "Objection Handler AI",
		description: "Turn objections into opportunities. Proven responses backed by industry psychology.",
		span: 1,
	},
];

export function Features() {
	return (
		<section id="features" className="relative border-t border-slate-800/50 bg-storm-z1 py-28">
			<div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-storm-purple/10 blur-[150px]" />
			<div className="absolute bottom-1/4 left-0 h-64 w-64 rounded-full bg-storm-glow/10 blur-[120px]" />

			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mb-20 text-center"
				>
					<span className="text-sm font-bold uppercase tracking-[0.2em] text-storm-glow">Features</span>
					<h2 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">
						Everything you need to close claims faster
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
						AI-powered tools built specifically for roofing insurance workflow.
					</p>
				</motion.div>

				{/* Bento grid */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
					{features.map((feature, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: index * 0.06 }}
							className={`group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/40 to-slate-900/60 p-8 transition-all duration-300 hover:border-storm-purple/40 hover:shadow-xl hover:shadow-storm-purple/10 ${
								feature.span === 2 ? "sm:col-span-2" : ""
							}`}
						>
							<div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-storm-purple/10 blur-2xl transition-opacity group-hover:opacity-100" />
							<div className="relative">
								<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-storm-purple/20 text-storm-glow transition-colors group-hover:bg-storm-purple/30">
									{feature.icon}
								</div>
								<h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
								<p className="text-slate-400 leading-relaxed">{feature.description}</p>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
