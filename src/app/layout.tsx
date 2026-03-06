import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "StormClose AI",
	description: "AI-powered roofing workflow platform"
};

export default async function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="dark">
			<body className="min-h-screen bg-[#0B0F1A] antialiased">
				{children}
			</body>
		</html>
	);
}
