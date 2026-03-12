"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface CardProps {
	children: ReactNode;
	className?: string;
	hover?: boolean;
	glow?: boolean;
}

export function Card({
	children,
	className = "",
	hover = false,
	glow = false,
}: CardProps) {
	const Component = hover ? motion.div : "div";

	const hoverProps = hover
		? {
				whileHover: { y: -4, transition: { duration: 0.2 } },
		  }
		: {};

	return (
		<Component
			className={`rounded-xl border border-storm-border bg-storm-z1 p-6 ${
				hover
					? "transition-all hover:border-storm-purple/30 hover:shadow-xl hover:shadow-storm-purple/5"
					: ""
			} ${glow ? "shadow-lg shadow-storm-purple/10" : ""} ${className}`}
			{...hoverProps}
		>
			{children}
		</Component>
	);
}

interface CardHeaderProps {
	children: ReactNode;
	className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
	return (
		<div className={`mb-4 ${className}`}>
			{children}
		</div>
	);
}

interface CardTitleProps {
	children: ReactNode;
	className?: string;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
	return (
		<h3 className={`text-lg font-semibold text-white ${className}`}>
			{children}
		</h3>
	);
}

interface CardDescriptionProps {
	children: ReactNode;
	className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
	return (
		<p className={`text-sm text-slate-400 ${className}`}>
			{children}
		</p>
	);
}

interface CardContentProps {
	children: ReactNode;
	className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
	return <div className={className}>{children}</div>;
}
