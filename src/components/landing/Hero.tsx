"use client";

import { motion } from "framer-motion";
import { useDemoModal } from "./DemoContext";

export function Hero() {
	const { openDemoModal } = useDemoModal();

	return (
		<section className="relative min-h-screen overflow-hidden bg-storm-z0 pt-20">
			{/* Gradient mesh */}
			<div className="absolute inset-0">
				<div className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-storm-purple/25 blur-[200px]" />
				<div className="absolute -right-48 top-1/3 h-[500px] w-[500px] rounded-full bg-storm-glow/15 blur-[180px]" />
				<div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-storm-purple/10 blur-[150px]" />
				<div
					className="absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: "radial-gradient(circle at 1px 1px, rgba(167,139,250,0.5) 1px, transparent 0)",
						backgroundSize: "32px 32px",
					}}
				/>
			</div>

			<div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-16 px-4 pb-20 pt-12 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pt-0">
				{/* Copy */}
				<motion.div
					initial={{ opacity: 0, x: -32 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.7 }}
					className="flex-1 text-center lg:text-left"
				>
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1, duration: 0.5 }}
						className="mb-8 inline-flex items-center gap-2 rounded-full border border-storm-purple/40 bg-storm-purple/15 px-5 py-2"
					>
						<span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
						<span className="text-sm font-bold text-storm-glow">Monitoring storms in real-time</span>
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, duration: 0.7 }}
						className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
						style={{ lineHeight: 1.05 }}
					>
						The AI platform{" "}
						<span className="bg-gradient-to-r from-storm-glow via-storm-purple to-storm-glow bg-[length:200%_auto] bg-clip-text text-transparent">
							built for storm
						</span>{" "}
						<span className="bg-gradient-to-r from-storm-purple to-storm-glow bg-clip-text text-transparent">
							roofing teams
						</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.35, duration: 0.7 }}
						className="mx-auto mt-8 max-w-lg text-lg text-slate-400 lg:mx-0"
					>
						Detect hail and wind events, deploy field teams, generate AI reports,
						close claims, and track every dollar back to its source.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5, duration: 0.7 }}
						className="mt-10 flex flex-col items-center gap-5 sm:flex-row lg:justify-start"
					>
						<button
							onClick={openDemoModal}
							className="w-full rounded-2xl bg-storm-purple px-8 py-4 text-base font-bold text-white shadow-lg shadow-storm-purple/25 transition-all hover:bg-storm-purple-hover hover:shadow-xl hover:shadow-storm-purple/30 sm:w-auto"
						>
							Request Demo
						</button>
						<a
							href="#products"
							className="flex items-center gap-2 text-base font-semibold text-slate-400 transition-colors hover:text-white"
						>
							See how it works
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</a>
					</motion.div>
				</motion.div>

				{/* Storm map mockup */}
				<motion.div
					initial={{ opacity: 0, x: 48 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.2, duration: 0.8 }}
					className="relative w-full max-w-2xl flex-shrink-0 lg:max-w-[540px]"
				>
					<div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 blur-2xl" />
					<div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-storm-z1 p-1.5 shadow-2xl shadow-black/50">
						<div className="rounded-[20px] bg-storm-z0 p-5">
							{/* Top bar */}
							<div className="mb-4 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="flex gap-1.5">
										<div className="h-3 w-3 rounded-full bg-red-500/90" />
										<div className="h-3 w-3 rounded-full bg-amber-500/90" />
										<div className="h-3 w-3 rounded-full bg-emerald-500/90" />
									</div>
									<span className="ml-3 text-xs font-medium text-slate-500">Storm Ops</span>
								</div>
								<div className="flex items-center gap-1.5">
									<div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
									<span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
								</div>
							</div>

							{/* Map area */}
							<div className="relative h-48 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 sm:h-56">
								<div className="absolute inset-0 bg-gradient-to-br from-storm-purple/5 to-transparent" />
								<div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(167,139,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.4) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

								{/* Storm markers */}
								<motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} className="absolute left-[25%] top-[35%] h-4 w-4 rounded-full bg-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
								<motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }} className="absolute left-[55%] top-[45%] h-5 w-5 rounded-full bg-amber-500/70 shadow-[0_0_14px_rgba(245,158,11,0.5)]" />
								<motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 3, repeat: Infinity, delay: 0.8 }} className="absolute left-[72%] top-[28%] h-3 w-3 rounded-full bg-red-400/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
								<div className="absolute left-[40%] top-[60%] h-2 w-2 rounded-full bg-amber-400/50" />
								<div className="absolute left-[15%] top-[55%] h-2 w-2 rounded-full bg-storm-purple/50" />

								{/* Tooltip */}
								<div className="absolute left-[50%] top-[38%] rounded-lg border border-slate-700 bg-storm-z1/95 px-2.5 py-1.5 shadow-lg">
									<div className="text-[10px] font-bold text-white">2.5&quot; Hail</div>
									<div className="text-[9px] text-slate-400">Dallas, TX</div>
								</div>
							</div>

							{/* KPI strip */}
							<div className="mt-4 grid grid-cols-4 gap-2">
								{[
									{ label: "Severe", value: "3", color: "text-red-400" },
									{ label: "At Risk", value: "847", color: "text-amber-400" },
									{ label: "Max Hail", value: "2.5\"", color: "text-storm-glow" },
									{ label: "Missions", value: "2", color: "text-emerald-400" },
								].map((kpi) => (
									<div key={kpi.label} className="rounded-lg bg-slate-800/50 p-2 text-center">
										<div className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</div>
										<div className="text-[10px] text-slate-500">{kpi.label}</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</motion.div>
			</div>

			<div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-storm-bg to-transparent" />
		</section>
	);
}
