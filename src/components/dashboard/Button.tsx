"use client";

import { forwardRef, ReactNode, MouseEventHandler } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	glow?: boolean;
	children?: ReactNode;
	className?: string;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
	onClick?: MouseEventHandler<HTMLButtonElement>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			variant = "primary",
			size = "md",
			isLoading = false,
			glow = false,
			className = "",
			disabled,
			type = "button",
			onClick,
		},
		ref
	) => {
		const baseStyles =
			"inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F1A] disabled:opacity-50 disabled:cursor-not-allowed";

		const variants = {
			primary:
				"bg-[#6D5CFF] text-white hover:bg-[#5B4AE8] focus:ring-[#6D5CFF] shadow-lg shadow-[#6D5CFF]/20 hover:shadow-xl hover:shadow-[#6D5CFF]/30",
			secondary:
				"bg-[#1E293B] text-slate-200 border border-slate-700 hover:bg-[#334155] hover:border-slate-600 focus:ring-slate-500",
			ghost:
				"bg-transparent text-slate-300 hover:bg-[#1E293B] hover:text-white focus:ring-slate-500",
			danger:
				"bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
		};

		const sizes = {
			sm: "px-3 py-1.5 text-sm",
			md: "px-4 py-2 text-sm",
			lg: "px-6 py-3 text-base",
		};

		return (
			<motion.button
				ref={ref}
				whileHover={{ scale: disabled ? 1 : 1.02 }}
				whileTap={{ scale: disabled ? 1 : 0.98 }}
				className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
					glow ? "shadow-lg shadow-[#6D5CFF]/30" : ""
				} ${className}`}
				disabled={disabled || isLoading}
				type={type}
				onClick={onClick}
			>
				{isLoading ? (
					<>
						<svg
							className="mr-2 h-4 w-4 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						Loading...
					</>
				) : (
					children
				)}
			</motion.button>
		);
	}
);

Button.displayName = "Button";

export function GlowButton({
	children,
	className = "",
	...props
}: ButtonProps) {
	return (
		<div className="relative group">
			<div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-[#6D5CFF] to-[#A78BFA] opacity-50 blur group-hover:opacity-75 transition duration-300" />
			<Button
				className={`relative ${className}`}
				variant="primary"
				{...props}
			>
				{children}
			</Button>
		</div>
	);
}
