import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
	],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#ecfeff",
					100: "#cffafe",
					500: "#06b6d4",
					600: "#0891b2",
					700: "#0e7490"
				},
				storm: {
					bg: "#0B0F1A",
					deep: "#111827",
					purple: "#6D5CFF",
					glow: "#A78BFA",
					slate: "#1E293B",
					text: "#F9FAFB",
				}
			},
			animation: {
				"pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
				"glow": "glow 2s ease-in-out infinite alternate",
			},
			keyframes: {
				glow: {
					"0%": { opacity: "0.5" },
					"100%": { opacity: "1" },
				},
			},
		}
	},
	plugins: []
};

export default config;
