"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
	title: string;
	value: string | number;
	description?: string;
	icon?: ReactNode;
	trend?: {
		value: number;
		isPositive: boolean;
	};
}

export function StatCard({
	title,
	value,
	description,
	icon,
	trend,
}: StatCardProps) {
	return (
		<motion.div
			whileHover={{ y: -4, transition: { duration: 0.2 } }}
			className="group relative overflow-hidden rounded-xl border border-[#1F2937] bg-[#111827] p-6 transition-all hover:border-[#6D5CFF]/30 hover:shadow-xl hover:shadow-[#6D5CFF]/5"
		>
			{/* Background glow on hover */}
			<div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#6D5CFF]/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />

			<div className="relative">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-sm font-medium text-slate-400">{title}</p>
						<p className="mt-2 text-3xl font-bold text-white">{value}</p>
					</div>
					{icon && (
						<div className="rounded-lg bg-[#6D5CFF]/10 p-2 text-[#A78BFA]">
							{icon}
						</div>
					)}
				</div>

				{(description || trend) && (
					<div className="mt-4 flex items-center gap-2">
						{trend && (
							<span
								className={`flex items-center text-sm font-medium ${
									trend.isPositive ? "text-green-400" : "text-red-400"
								}`}
							>
								<svg
									className={`mr-1 h-4 w-4 ${
										trend.isPositive ? "" : "rotate-180"
									}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 10l7-7m0 0l7 7m-7-7v18"
									/>
								</svg>
								{trend.value}%
							</span>
						)}
						{description && (
							<span className="text-sm text-slate-500">{description}</span>
						)}
					</div>
				)}
			</div>
		</motion.div>
	);
}
