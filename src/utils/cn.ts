/**
 * Utility for conditionally joining classNames together.
 * Lightweight alternative to clsx/tailwind-merge.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
	return inputs.filter(Boolean).join(" ");
}
