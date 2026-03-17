"use client";

import { forwardRef, type ReactNode, type MouseEventHandler } from "react";
import { Button as BaseButton, type ButtonProps as BaseButtonProps } from "@/components/ui/button";

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

const variantMap: Record<NonNullable<ButtonProps["variant"]>, BaseButtonProps["variant"]> = {
	primary: "primary",
	secondary: "secondary",
	ghost: "ghost",
	danger: "danger",
};

const sizeMap: Record<NonNullable<ButtonProps["size"]>, BaseButtonProps["size"]> = {
	sm: "sm",
	md: "md",
	lg: "lg",
};

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
	) => (
		<BaseButton
			ref={ref}
			variant={glow && variant === "primary" ? "glow" : variantMap[variant]}
			size={sizeMap[size]}
			className={className}
			disabled={disabled || isLoading}
			type={type}
			onClick={onClick}
		>
			{isLoading ? (
				<>
					<svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
		</BaseButton>
	)
);

Button.displayName = "Button";

export function GlowButton({ children, className = "", ...props }: ButtonProps) {
	return (
		<Button className={className} variant="primary" glow {...props}>
			{children}
		</Button>
	);
}
