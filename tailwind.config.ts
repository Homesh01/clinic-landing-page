import type { Config } from "tailwindcss";

export default {
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: {
			colors: {
				ink: {
					DEFAULT: "#15202b",
					soft: "#2a3644",
					muted: "#5d6b78",
				},
				cream: "#f8f7f4",
				mist: "#eef2f4",
				line: "#dce3e8",
				accent: {
					DEFAULT: "#1f6f6a",
					deep: "#155652",
					soft: "#e4f1ef",
				},
			},
			fontFamily: {
				display: [
					"Cormorant Garamond",
					"Georgia",
					"ui-serif",
					"serif",
				],
				sans: [
					"Source Sans 3",
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
				],
			},
			fontSize: {
				"display-xl": [
					"clamp(2.75rem, 6vw, 4.75rem)",
					{ lineHeight: "1.05", letterSpacing: "-0.02em" },
				],
				"display-lg": [
					"clamp(2.25rem, 4vw, 3.5rem)",
					{ lineHeight: "1.1", letterSpacing: "-0.015em" },
				],
				"display-md": [
					"clamp(1.75rem, 3vw, 2.5rem)",
					{ lineHeight: "1.15", letterSpacing: "-0.01em" },
				],
			},
			maxWidth: {
				content: "80rem",
				prose: "42rem",
			},
			keyframes: {
				"fade-up": {
					from: { opacity: "0", transform: "translateY(1.25rem)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
			},
			animation: {
				"fade-up": "fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
				"fade-in": "fade-in 1.1s ease both",
			},
		},
	},
	plugins: [],
} satisfies Config;
