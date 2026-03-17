"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import {
	Card as BaseCard,
	CardHeader as BaseCardHeader,
	CardTitle as BaseCardTitle,
	CardDescription as BaseCardDescription,
	CardContent as BaseCardContent,
} from "@/components/ui/card";
import { cn } from "@/utils/cn";

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
	const cardClassName = cn(
		"storm-card p-6",
		hover && "hover:-translate-y-0.5 hover:border-storm-border-light hover:shadow-depth-2",
		glow && "border-storm-purple/20 shadow-glow-sm",
		className
	);

	const hoverProps = hover
		? {
				whileHover: { y: -4, transition: { duration: 0.2 } },
		  }
		: {};

	if (hover) {
		return (
			<motion.div className={cardClassName} {...hoverProps}>
				{children}
			</motion.div>
		);
	}

	return <BaseCard className={cardClassName}>{children}</BaseCard>;
}

interface CardHeaderProps {
	children: ReactNode;
	className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
	return <BaseCardHeader className={cn("mb-4 p-0", className)}>{children}</BaseCardHeader>;
}

interface CardTitleProps {
	children: ReactNode;
	className?: string;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
	return <BaseCardTitle className={cn("text-lg", className)}>{children}</BaseCardTitle>;
}

interface CardDescriptionProps {
	children: ReactNode;
	className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
	return <BaseCardDescription className={cn("text-sm text-storm-muted", className)}>{children}</BaseCardDescription>;
}

interface CardContentProps {
	children: ReactNode;
	className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
	return <BaseCardContent className={cn("p-0", className)}>{children}</BaseCardContent>;
}
