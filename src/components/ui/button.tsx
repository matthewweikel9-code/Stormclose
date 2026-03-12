import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "glow";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"bg-storm-purple text-white hover:bg-storm-purple-hover hover:shadow-glow-sm active:scale-[0.98]",
	secondary:
		"bg-storm-z1 text-slate-300 border border-storm-border hover:bg-storm-z2 hover:text-white hover:border-storm-border-light active:scale-[0.98]",
	ghost:
		"text-storm-muted hover:bg-storm-z2 hover:text-white",
	danger:
		"bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:scale-[0.98]",
	glow:
		"bg-gradient-to-r from-storm-purple to-storm-glow text-white shadow-glow-sm hover:shadow-glow-md active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
	md: "h-10 px-4 text-sm gap-2 rounded-xl",
	lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
	icon: "h-9 w-9 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "md", ...props }, ref) => (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
				variantClasses[variant],
				sizeClasses[size],
				className
			)}
			{...props}
		/>
	)
);
Button.displayName = "Button";

export { Button, type ButtonProps };
