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
		title: "AI Claim Reports",
		description:
			"Generate insurance-ready reports instantly from Xactimate or JobNimbus files. Our AI understands roofing terminology and formats reports professionally.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		),
		title: "Automated Emails",
		description:
			"AI drafts professional emails to insurance adjusters. Customize tone and content, then send directly or copy to your email client.",
	},
	{
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
		),
		title: "CSV Upload",
		description:
			"Upload roofing estimates directly from your CRM. Support for Xactimate, JobNimbus, and other industry-standard formats.",
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
					className="mt-16 grid gap-8 md:grid-cols-3"
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
