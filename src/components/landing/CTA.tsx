"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function CTA() {
	return (
		<section className="relative overflow-hidden bg-[#111827] py-24">
			{/* Background effects */}
			<div className="absolute inset-0">
				{/* Gradient orbs */}
				<motion.div
					className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6D5CFF]/20 blur-[150px]"
					animate={{
						scale: [1, 1.1, 1],
						opacity: [0.2, 0.3, 0.2],
					}}
					transition={{
						duration: 4,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				/>
				<div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#A78BFA]/10 blur-[100px]" />
				<div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#6D5CFF]/15 blur-[100px]" />

				{/* Lightning lines */}
				<motion.div
					className="absolute left-1/4 top-0 h-full w-px bg-gradient-to-b from-[#6D5CFF]/30 via-[#A78BFA]/20 to-transparent"
					animate={{ opacity: [0.1, 0.3, 0.1] }}
					transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
				/>
				<motion.div
					className="absolute right-1/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#6D5CFF]/20 to-[#A78BFA]/30"
					animate={{ opacity: [0.1, 0.25, 0.1] }}
					transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
				/>
			</div>

			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="text-center"
				>
					{/* Icon */}
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						whileInView={{ scale: 1, opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="mx-auto mb-8 inline-flex items-center justify-center"
					>
						<div className="relative">
							<div className="absolute inset-0 rounded-full bg-[#6D5CFF]/30 blur-xl" />
							<div className="relative rounded-full border border-[#6D5CFF]/30 bg-[#6D5CFF]/10 p-4">
								<svg
									className="h-8 w-8 text-[#A78BFA]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</div>
						</div>
					</motion.div>

					{/* Headline */}
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.3 }}
						className="text-3xl font-bold text-white sm:text-4xl md:text-5xl"
					>
						Start Closing Claims{" "}
						<span className="bg-gradient-to-r from-[#A78BFA] to-[#6D5CFF] bg-clip-text text-transparent">
							Faster
						</span>
					</motion.h2>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.4 }}
						className="mx-auto mt-4 max-w-xl text-lg text-slate-400"
					>
						Join hundreds of roofing companies using StormClose AI to streamline 
						their insurance claims process.
					</motion.p>

					{/* CTA Button */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.5 }}
						className="mt-10"
					>
						<Link
							href="/signup"
							className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-[#6D5CFF] px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-[#5B4AE8] hover:shadow-2xl hover:shadow-[#6D5CFF]/30"
						>
							<span className="relative z-10 flex items-center gap-2">
								Get Started
								<svg
									className="h-5 w-5 transition-transform group-hover:translate-x-1"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
							</span>
							{/* Animated shine effect */}
							<motion.div
								className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
								initial={{ x: "-100%" }}
								animate={{ x: "100%" }}
								transition={{
									duration: 2,
									repeat: Infinity,
									repeatDelay: 3,
									ease: "easeInOut",
								}}
							/>
						</Link>
					</motion.div>

					{/* Additional info */}
					<motion.p
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.6 }}
						className="mt-6 text-sm text-slate-500"
					>
						Free 14-day trial • No credit card required • Cancel anytime
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
}
