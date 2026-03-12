import { type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type BadgeVariant = "default" | "purple" | "success" | "warning" | "danger" | "info" | "outline" | "live";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
	default: "bg-storm-z2 text-storm-muted border border-storm-border",
	purple: "bg-storm-purple/15 text-storm-glow border border-storm-purple/20",
	success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
	warning: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
	danger: "bg-red-500/15 text-red-400 border border-red-500/20",
	info: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
	outline: "bg-transparent text-storm-muted border border-storm-border",
	live: "bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse",
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
				variantClasses[variant],
				className
			)}
			{...props}
		/>
	);
}
