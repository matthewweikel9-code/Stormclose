import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "StormClose AI — Storm Ops, AI Supplements & CRM Sync",
	description: "From live hail tracking to closed deals. AI-powered storm ops, roof damage analysis, supplement generation, and JobNimbus sync for roofing teams.",
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
			<head>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
			</head>
			<body className="min-h-screen bg-storm-bg antialiased" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
				{children}
			</body>
		</html>
	);
}
