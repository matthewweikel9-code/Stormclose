"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function Hero() {
	return (
		<section className="relative min-h-screen overflow-hidden bg-[#0B0F1A] pt-16">
			{/* Animated background */}
			<div className="absolute inset-0 overflow-hidden">
				{/* Gradient orbs */}
				<div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#6D5CFF]/20 blur-[120px]" />
				<div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#A78BFA]/15 blur-[150px]" />
				<div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#6D5CFF]/10 blur-[100px]" />
				
				{/* Grid pattern */}
				<div 
					className="absolute inset-0 opacity-20"
					style={{
						backgroundImage: `linear-gradient(rgba(109, 92, 255, 0.1) 1px, transparent 1px),
							linear-gradient(90deg, rgba(109, 92, 255, 0.1) 1px, transparent 1px)`,
						backgroundSize: "64px 64px",
					}}
				/>

				{/* Lightning effect */}
				<motion.div
					className="absolute left-1/2 top-20 h-[500px] w-[2px] -translate-x-1/2 bg-gradient-to-b from-[#A78BFA] via-[#6D5CFF] to-transparent opacity-20"
					animate={{
						opacity: [0.1, 0.3, 0.1],
						scaleY: [1, 1.1, 1],
					}}
					transition={{
						duration: 3,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				/>
			</div>

			<div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8 }}
					className="text-center"
				>
					{/* Badge */}
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.2, duration: 0.5 }}
						className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6D5CFF]/30 bg-[#6D5CFF]/10 px-4 py-1.5"
					>
						<span className="h-2 w-2 rounded-full bg-[#6D5CFF] animate-pulse" />
						<span className="text-sm font-medium text-[#A78BFA]">
							AI-Powered Roofing Claims
						</span>
					</motion.div>

					{/* Headline */}
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3, duration: 0.8 }}
						className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
					>
						Close Insurance Claims{" "}
						<span className="bg-gradient-to-r from-[#A78BFA] to-[#6D5CFF] bg-clip-text text-transparent">
							Faster with AI
						</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5, duration: 0.8 }}
						className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl"
					>
						Upload your roofing estimate. StormClose automatically generates 
						professional insurance reports, follow-up emails, and documentation 
						in seconds.
					</motion.p>

					{/* CTA Buttons */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.7, duration: 0.8 }}
						className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
					>
						<Link
							href="/signup"
							className="group relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-[#6D5CFF] px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-[#5B4AE8] hover:shadow-xl hover:shadow-[#6D5CFF]/25"
						>
							<span className="relative z-10">Get Started</span>
							<motion.div
								className="absolute inset-0 bg-gradient-to-r from-[#A78BFA] to-[#6D5CFF]"
								animate={{
									x: ["-100%", "100%"],
								}}
								transition={{
									duration: 2,
									repeat: Infinity,
									ease: "linear",
								}}
								style={{ opacity: 0.3 }}
							/>
						</Link>
						<Link
							href="#how-it-works"
							className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-slate-600 hover:bg-slate-800"
						>
							<svg
								className="h-5 w-5 text-[#A78BFA]"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							View Demo
						</Link>
					</motion.div>

					{/* Trust indicators */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1, duration: 0.8 }}
						className="mt-16 flex flex-col items-center gap-4"
					>
						<p className="text-sm text-slate-500">Built for roofing professionals</p>
						<div className="flex items-center gap-6">
							<div className="flex items-center gap-2">
								<svg className="h-5 w-5 text-[#6D5CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span className="text-sm text-slate-400">AI-Powered Reports</span>
							</div>
							<div className="flex items-center gap-2">
								<svg className="h-5 w-5 text-[#6D5CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
								<span className="text-sm text-slate-400">Generate in Seconds</span>
							</div>
							<div className="flex items-center gap-2">
								<svg className="h-5 w-5 text-[#6D5CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
								<span className="text-sm text-slate-400">Secure & Private</span>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>

			{/* Bottom fade */}
			<div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B0F1A] to-transparent" />
		</section>
	);
}
