"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function Counter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
	const count = useMotionValue(0);
	const rounded = useTransform(count, (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`);
	const ref = useRef<HTMLSpanElement>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		if (!ref.current) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && !inView) {
					setInView(true);
					animate(count, target, { duration: 1.8, ease: "easeOut" });
				}
			},
			{ threshold: 0.3 }
		);
		observer.observe(ref.current);
		return () => observer.disconnect();
	}, [count, target, inView]);

	return <motion.span ref={ref}>{rounded}</motion.span>;
}

const stats = [
	{ value: 50000, suffix: "+", label: "Properties Analyzed" },
	{ value: 89, suffix: "%", label: "Claim Approval Rate" },
	{ value: 2, prefix: "$", suffix: "M+", label: "Claims Closed" },
	{ value: 30, suffix: "+", label: "States Covered" },
];

export function StatsStrip() {
	return (
		<section className="relative border-y border-slate-800/30 bg-storm-z1 py-20">
			<div className="absolute inset-0 bg-gradient-to-r from-storm-purple/5 via-transparent to-storm-glow/5" />
			<div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
					{stats.map((stat, i) => (
						<motion.div
							key={stat.label}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: i * 0.1, duration: 0.6 }}
							className="text-center"
						>
							<div className="text-4xl font-extrabold text-white sm:text-5xl">
								<Counter target={stat.value} suffix={stat.suffix} prefix={stat.prefix ?? ""} />
							</div>
							<div className="mt-2 text-sm font-medium text-slate-400">{stat.label}</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
