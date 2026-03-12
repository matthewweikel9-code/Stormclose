import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#ecfeff",
					100: "#cffafe",
					500: "#06b6d4",
					600: "#0891b2",
					700: "#0e7490",
				},
				storm: {
					// Background depth layers (z0 deepest → z3 elevated)
					bg: "#0B0F1A",
					z0: "#0B0F1A",
					z1: "#111827",
					z2: "#1A1F2E",
					z3: "#242938",
					// Core palette
					deep: "#111827",
					purple: "#6D5CFF",
					"purple-hover": "#5B4AE8",
					glow: "#A78BFA",
					slate: "#1E293B",
					text: "#F9FAFB",
					muted: "#94A3B8",
					subtle: "#64748B",
					// Borders
					border: "#1F2937",
					"border-light": "#374151",
					// Accents
					success: "#10B981",
					warning: "#F59E0B",
					danger: "#EF4444",
					info: "#3B82F6",
				},
			},
			spacing: {
				"sidebar-collapsed": "4.5rem", // 72px
				"sidebar-expanded": "16.5rem", // 264px
				"topnav": "4rem", // 64px
			},
			borderRadius: {
				"2xl": "1rem",
				"3xl": "1.25rem",
			},
			fontSize: {
				"2xs": ["0.625rem", { lineHeight: "0.875rem" }],
			},
			boxShadow: {
				"glow-sm": "0 0 12px -3px rgba(109, 92, 255, 0.3)",
				"glow-md": "0 0 24px -5px rgba(109, 92, 255, 0.35)",
				"glow-lg": "0 0 40px -8px rgba(109, 92, 255, 0.4)",
				"depth-1": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
				"depth-2": "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
				"depth-3": "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)",
				"depth-4": "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
				"inner-glow": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
			},
			animation: {
				"pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				"glow": "glow 2s ease-in-out infinite alternate",
				"shimmer": "shimmer 2s linear infinite",
				"slide-in-left": "slideInLeft 0.3s ease-out",
				"slide-in-right": "slideInRight 0.2s ease-out",
				"fade-in": "fadeIn 0.3s ease-out",
				"fade-in-up": "fadeInUp 0.4s ease-out",
				"scale-in": "scaleIn 0.2s ease-out",
				"count-up": "countUp 0.6s ease-out",
			},
			keyframes: {
				glow: {
					"0%": { opacity: "0.5" },
					"100%": { opacity: "1" },
				},
				shimmer: {
					"0%": { transform: "translateX(-100%)" },
					"100%": { transform: "translateX(100%)" },
				},
				slideInLeft: {
					"0%": { transform: "translateX(-12px)", opacity: "0" },
					"100%": { transform: "translateX(0)", opacity: "1" },
				},
				slideInRight: {
					"0%": { transform: "translateX(12px)", opacity: "0" },
					"100%": { transform: "translateX(0)", opacity: "1" },
				},
				fadeIn: {
					"0%": { opacity: "0" },
					"100%": { opacity: "1" },
				},
				fadeInUp: {
					"0%": { transform: "translateY(8px)", opacity: "0" },
					"100%": { transform: "translateY(0)", opacity: "1" },
				},
				scaleIn: {
					"0%": { transform: "scale(0.95)", opacity: "0" },
					"100%": { transform: "scale(1)", opacity: "1" },
				},
				countUp: {
					"0%": { transform: "translateY(4px)", opacity: "0" },
					"100%": { transform: "translateY(0)", opacity: "1" },
				},
			},
			backdropBlur: {
				xs: "2px",
			},
			transitionDuration: {
				"250": "250ms",
			},
		},
	},
	plugins: [],
};

export default config;
