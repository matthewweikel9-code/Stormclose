"use client";

import { motion } from "framer-motion";

const steps = [
	{
		number: "01",
		title: "Upload Estimate",
		description: "Upload your CSV file from Xactimate or JobNimbus. Our system automatically parses and validates your roofing estimate data.",
		icon: (
			<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
				/>
			</svg>
		),
	},
	{
		number: "02",
		title: "AI Generates Report",
		description: "StormClose AI analyzes your estimate and builds a professional insurance claim summary with all required documentation.",
		icon: (
			<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		),
	},
	{
		number: "03",
		title: "Send to Insurance",
		description: "Copy the report or use our AI-generated email templates to send directly to insurance adjusters. Track responses in one place.",
		icon: (
			<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
				/>
			</svg>
		),
	},
];

export function HowItWorks() {
	return (
		<section id="how-it-works" className="relative bg-[#111827] py-24">
			{/* Background */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute left-1/2 top-0 h-px w-full max-w-2xl -translate-x-1/2 bg-gradient-to-r from-transparent via-[#6D5CFF]/50 to-transparent" />
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
						How It Works
					</span>
					<h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
						Three simple steps to faster claims
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
						Get from estimate to insurance submission in minutes, not hours.
					</p>
				</motion.div>

				{/* Steps */}
				<div className="mt-16 grid gap-8 lg:grid-cols-3">
					{steps.map((step, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.2 }}
							className="relative"
						>
							{/* Connector line */}
							{index < steps.length - 1 && (
								<div className="absolute left-1/2 top-16 hidden h-px w-full bg-gradient-to-r from-[#6D5CFF]/50 to-transparent lg:block" />
							)}

							<div className="relative flex flex-col items-center text-center">
								{/* Step number circle */}
								<motion.div
									whileHover={{ scale: 1.1 }}
									className="relative mb-6"
								>
									<div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#6D5CFF]/30 bg-gradient-to-b from-[#6D5CFF]/20 to-transparent text-[#A78BFA]">
										{step.icon}
									</div>
									<span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#6D5CFF] text-sm font-bold text-white">
										{step.number.replace("0", "")}
									</span>
								</motion.div>

								{/* Content */}
								<h3 className="mb-3 text-xl font-semibold text-white">
									{step.title}
								</h3>
								<p className="max-w-sm text-slate-400 leading-relaxed">
									{step.description}
								</p>
							</div>
						</motion.div>
					))}
				</div>

				{/* Optional: Demo preview */}
				<motion.div
					initial={{ opacity: 0, y: 40 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8, delay: 0.4 }}
					className="mt-20"
				>
					<div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-1">
						{/* Mock dashboard preview */}
						<div className="rounded-xl bg-[#0B0F1A] p-6">
							<div className="flex items-center gap-2 border-b border-slate-800 pb-4">
								<div className="h-3 w-3 rounded-full bg-red-500/80" />
								<div className="h-3 w-3 rounded-full bg-yellow-500/80" />
								<div className="h-3 w-3 rounded-full bg-green-500/80" />
								<span className="ml-4 text-sm text-slate-500">StormClose Dashboard</span>
							</div>
							<div className="mt-6 grid gap-4 md:grid-cols-3">
								<div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
									<div className="text-2xl font-bold text-white">47</div>
									<div className="text-sm text-slate-400">Reports Generated</div>
								</div>
								<div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
									<div className="text-2xl font-bold text-[#A78BFA]">89%</div>
									<div className="text-sm text-slate-400">Approval Rate</div>
								</div>
								<div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
									<div className="text-2xl font-bold text-green-400">$124K</div>
									<div className="text-sm text-slate-400">Claims Closed</div>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
