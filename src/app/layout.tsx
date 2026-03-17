import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "StormClose AI",
	description: "AI-powered roofing workflow platform",
	icons: {
		icon: "/favicon.svg",
		shortcut: "/favicon.svg",
		apple: "/favicon.svg",
	},
};

export default async function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="dark">
			<body className="min-h-screen bg-storm-bg antialiased">
				{children}
			</body>
		</html>
	);
}
