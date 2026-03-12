import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

/* ─── Card ─── */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("storm-card", className)}
			{...props}
		/>
	)
);
Card.displayName = "Card";

/* ─── CardHeader ─── */
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex flex-col gap-1.5 px-5 pt-5 pb-0", className)}
			{...props}
		/>
	)
);
CardHeader.displayName = "CardHeader";

/* ─── CardTitle ─── */
const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<h3
			ref={ref}
			className={cn("text-sm font-semibold text-white leading-none tracking-tight", className)}
			{...props}
		/>
	)
);
CardTitle.displayName = "CardTitle";

/* ─── CardDescription ─── */
const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
	({ className, ...props }, ref) => (
		<p
			ref={ref}
			className={cn("text-xs text-storm-muted", className)}
			{...props}
		/>
	)
);
CardDescription.displayName = "CardDescription";

/* ─── CardContent ─── */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("px-5 py-4", className)}
			{...props}
		/>
	)
);
CardContent.displayName = "CardContent";

/* ─── CardFooter ─── */
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex items-center px-5 pb-5 pt-0", className)}
			{...props}
		/>
	)
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
