"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface TooltipProps {
	children: ReactNode;
	content: string;
	side?: "top" | "right" | "bottom" | "left";
	className?: string;
	delayMs?: number;
}

const sideClasses = {
	top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
	right: "left-full top-1/2 -translate-y-1/2 ml-2",
	bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
	left: "right-full top-1/2 -translate-y-1/2 mr-2",
};

export function Tooltip({ children, content, side = "right", className, delayMs = 0 }: TooltipProps) {
	const [visible, setVisible] = useState(false);
	const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

	const show = () => {
		if (delayMs > 0) {
			const id = setTimeout(() => setVisible(true), delayMs);
			setTimeoutId(id);
		} else {
			setVisible(true);
		}
	};

	const hide = () => {
		if (timeoutId) clearTimeout(timeoutId);
		setVisible(false);
	};

	return (
		<div className="relative" onMouseEnter={show} onMouseLeave={hide}>
			{children}
			{visible && (
				<div
					className={cn(
						"absolute z-50 whitespace-nowrap rounded-lg bg-storm-z3 px-3 py-1.5 text-xs font-medium text-white shadow-depth-3 border border-storm-border-light animate-scale-in pointer-events-none",
						sideClasses[side],
						className
					)}
				>
					{content}
				</div>
			)}
		</div>
	);
}
