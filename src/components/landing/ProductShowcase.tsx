"use client";

import { motion } from "framer-motion";

const products = [
	{
		tag: "Core Product",
		title: "Storm Ops",
		description:
			"Live hail and wind monitoring with an interactive command center. Deploy teams to high-impact zones, track storm timelines, and assess property damage from one map.",
		bullets: [
			"Live hail, wind, and tornado tracking via XWeather",
			"Radar overlay with storm timeline",
			"Property impact assessment with CoreLogic data",
			"Mission deployment and route optimization",
			"Auto-export to JobNimbus on appointment set",
		],
		mockup: (
			<div className="rounded-xl bg-storm-z0 p-4">
				<div className="mb-3 flex items-center gap-2">
					<div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
					<span className="text-xs font-semibold text-emerald-400">LIVE</span>
					<span className="text-xs text-slate-500">Storm Ops</span>
				</div>
				<div className="relative h-44 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80">
					<div className="absolute inset-0 bg-gradient-to-br from-storm-purple/10 to-storm-glow/5" />
					{/* Map dots */}
					<div className="absolute left-[20%] top-[30%] h-3 w-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
					<div className="absolute left-[45%] top-[50%] h-4 w-4 rounded-full bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse" />
					<div className="absolute left-[70%] top-[25%] h-3 w-3 rounded-full bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
					<div className="absolute left-[55%] top-[65%] h-2 w-2 rounded-full bg-amber-400/60" />
					{/* Grid lines */}
					<div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(167,139,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.3) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
				</div>
				<div className="mt-3 grid grid-cols-3 gap-2">
					<div className="rounded-lg bg-slate-800/60 p-2 text-center">
						<div className="text-sm font-bold text-red-400">3</div>
						<div className="text-[10px] text-slate-500">Severe</div>
					</div>
					<div className="rounded-lg bg-slate-800/60 p-2 text-center">
						<div className="text-sm font-bold text-amber-400">2.5&quot;</div>
						<div className="text-[10px] text-slate-500">Max Hail</div>
					</div>
					<div className="rounded-lg bg-slate-800/60 p-2 text-center">
						<div className="text-sm font-bold text-storm-glow">847</div>
						<div className="text-[10px] text-slate-500">Properties</div>
					</div>
				</div>
			</div>
		),
	},
	{
		tag: "AI-Powered",
		title: "AI Assistant",
		description:
			"GPT-4o sales assistant trained on roofing insurance. Generate storm reports, look up properties, analyze roofs, draft supplements, and handle objections in one chat.",
		bullets: [
			"Storm report generation from live data",
			"Property lookup with owner name and roof details",
			"Satellite roof analysis and measurements",
			"Insurance supplement drafting",
			"Objection handling with proven scripts",
		],
		mockup: (
			<div className="rounded-xl bg-storm-z0 p-4">
				<div className="mb-3 flex items-center gap-2">
					<div className="h-2 w-2 rounded-full bg-storm-purple animate-pulse" />
					<span className="text-xs font-semibold text-storm-glow">AI</span>
					<span className="text-xs text-slate-500">Assistant</span>
				</div>
				<div className="space-y-3">
					<div className="flex justify-end">
						<div className="max-w-[80%] rounded-xl rounded-br-sm bg-storm-purple/20 px-3 py-2 text-xs text-slate-300">
							Pull a storm report for Dallas, TX this week
						</div>
					</div>
					<div className="flex justify-start">
						<div className="max-w-[85%] rounded-xl rounded-bl-sm border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
							<div className="mb-1 font-semibold text-storm-glow">Storm Report: Dallas, TX</div>
							<div className="text-[11px] text-slate-400">3 severe events detected in the last 7 days. 2.5&quot; hail reported near Garland. 847 properties in impact zone...</div>
						</div>
					</div>
					<div className="flex justify-end">
						<div className="max-w-[70%] rounded-xl rounded-br-sm bg-storm-purple/20 px-3 py-2 text-xs text-slate-300">
							Show me properties with roof age &gt; 15 years
						</div>
					</div>
				</div>
			</div>
		),
	},
	{
		tag: "Enterprise",
		title: "Referral Engine",
		description:
			"Turn your partner network into a lead pipeline. Activate referral sources after storms, route opportunities to your CRM, and track partner-attributed revenue.",
		bullets: [
			"Partner management with tiers and territories",
			"Referral pipeline from submission to close",
			"Revenue attribution: partner to job to revenue",
			"Auto-sync referrals to JobNimbus",
			"Storm-triggered partner activation alerts",
		],
		mockup: (
			<div className="rounded-xl bg-storm-z0 p-4">
				<div className="mb-3 flex items-center gap-2">
					<div className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">NEW</div>
					<span className="text-xs text-slate-500">Referral Engine</span>
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-3 gap-2">
						<div className="rounded-lg bg-slate-800/60 p-2 text-center">
							<div className="text-sm font-bold text-white">24</div>
							<div className="text-[10px] text-slate-500">Partners</div>
						</div>
						<div className="rounded-lg bg-slate-800/60 p-2 text-center">
							<div className="text-sm font-bold text-storm-glow">38%</div>
							<div className="text-[10px] text-slate-500">Close Rate</div>
						</div>
						<div className="rounded-lg bg-slate-800/60 p-2 text-center">
							<div className="text-sm font-bold text-emerald-400">$47K</div>
							<div className="text-[10px] text-slate-500">Revenue</div>
						</div>
					</div>
					{/* Pipeline */}
					<div className="flex gap-1 pt-1">
						<div className="h-2 flex-[3] rounded-full bg-storm-purple/60" />
						<div className="h-2 flex-[2] rounded-full bg-storm-glow/50" />
						<div className="h-2 flex-[1] rounded-full bg-emerald-500/50" />
						<div className="h-2 flex-[1] rounded-full bg-slate-700" />
					</div>
					<div className="flex justify-between text-[10px] text-slate-500">
						<span>Received</span>
						<span>Inspected</span>
						<span>Closed</span>
					</div>
					{/* Referral rows */}
					<div className="space-y-1 pt-1">
						{[{ name: "Sarah M.", status: "Inspection", color: "text-amber-400" }, { name: "Mike R.", status: "Closed", color: "text-emerald-400" }].map((r) => (
							<div key={r.name} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-2 py-1.5">
								<span className="text-xs text-slate-300">{r.name}</span>
								<span className={`text-[10px] font-medium ${r.color}`}>{r.status}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		),
	},
];

export function ProductShowcase() {
	return (
		<section id="products" className="relative border-t border-slate-800/30 bg-storm-z0 py-28">
			<div className="absolute left-0 top-1/4 h-96 w-96 rounded-full bg-storm-purple/8 blur-[160px]" />
			<div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-storm-glow/8 blur-[120px]" />

			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
					className="mb-20 text-center"
				>
					<span className="text-sm font-bold uppercase tracking-[0.2em] text-storm-glow">Products</span>
					<h2 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">
						Three engines that power your growth
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
						From storm detection to closed deals, StormClose covers every step.
					</p>
				</motion.div>

				<div className="space-y-20">
					{products.map((product, index) => (
						<motion.div
							key={product.title}
							initial={{ opacity: 0, y: 32 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.7 }}
							className={`flex flex-col gap-12 lg:flex-row lg:items-center ${
								index % 2 === 1 ? "lg:flex-row-reverse" : ""
							}`}
						>
							{/* Text */}
							<div className="flex-1">
								<div className="mb-4 inline-flex rounded-full border border-storm-purple/30 bg-storm-purple/10 px-3 py-1">
									<span className="text-xs font-bold text-storm-glow">{product.tag}</span>
								</div>
								<h3 className="text-3xl font-extrabold text-white sm:text-4xl">{product.title}</h3>
								<p className="mt-4 text-lg text-slate-400 leading-relaxed">{product.description}</p>
								<ul className="mt-8 space-y-3">
									{product.bullets.map((bullet) => (
										<li key={bullet} className="flex items-start gap-3">
											<svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-storm-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
											<span className="text-slate-300">{bullet}</span>
										</li>
									))}
								</ul>
							</div>

							{/* Mockup */}
							<div className="flex-1">
								<div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-storm-z1 p-2 shadow-2xl shadow-black/30">
									{product.mockup}
								</div>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
