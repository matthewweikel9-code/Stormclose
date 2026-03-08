"use client";

import { motion } from "framer-motion";

const features = [
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
		),
		title: "Supplement Generator AI",
		description:
			"Upload adjuster estimates and instantly identify missing line items. Our AI finds overlooked damage and generates professional supplement requests.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
		),
		title: "AI Negotiation Coach",
		description:
			"Real-time coaching during adjuster calls. Get state-specific O&P arguments, depreciation rebuttals, and line-item justifications on demand.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
				/>
			</svg>
		),
		title: "Carrier Intelligence",
		description:
			"Know your opponent. Access approval rates, preferred adjusters, common denial tactics, and negotiation patterns for every major insurance carrier.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
				/>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		),
		title: "Lead Generator + Route Planner",
		description:
			"Search any area for property data including owner names, roof ages, and estimated claim values. Plan optimized door-knocking routes with one-click Google Maps navigation.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
		title: "Live Roof Measurement AI",
		description:
			"Instant satellite roof measurements. Get accurate square footage, pitch analysis, and panel counts in seconds - no ladder required.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
				/>
			</svg>
		),
		title: "Objection Handler AI",
		description:
			"Turn objections into opportunities. Get instant, proven responses to homeowner concerns backed by industry psychology and closing techniques.",
	},
];

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.2,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.6,
		},
	},
};

export function Features() {
	return (
		<section id="features" className="relative bg-[#0B0F1A] py-24">
			{/* Background elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-[#6D5CFF]/10 blur-[100px]" />
				<div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-[#A78BFA]/10 blur-[100px]" />
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
						Features
					</span>
					<h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
						Everything you need to close claims faster
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
						Streamline your roofing insurance workflow with AI-powered tools built 
						specifically for the industry.
					</p>
				</motion.div>

				{/* Features grid */}
				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true }}
					className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
				>
					{features.map((feature, index) => (
						<motion.div
							key={index}
							variants={itemVariants}
							whileHover={{ y: -8, transition: { duration: 0.3 } }}
							className="group relative rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-800/50 to-slate-900/50 p-8 transition-all hover:border-[#6D5CFF]/50 hover:shadow-xl hover:shadow-[#6D5CFF]/10"
						>
							{/* Icon */}
							<div className="mb-4 inline-flex items-center justify-center rounded-xl bg-[#6D5CFF]/10 p-3 text-[#A78BFA] transition-colors group-hover:bg-[#6D5CFF]/20">
								{feature.icon}
							</div>

							{/* Content */}
							<h3 className="mb-3 text-xl font-semibold text-white">
								{feature.title}
							</h3>
							<p className="text-slate-400 leading-relaxed">
								{feature.description}
							</p>

							{/* Hover gradient */}
							<div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#6D5CFF]/0 via-[#6D5CFF]/5 to-[#A78BFA]/0 opacity-0 transition-opacity group-hover:opacity-100" />
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
