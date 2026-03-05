import "../styles/globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "StormClose AI",
	description: "AI-powered roofing workflow platform"
};

export default async function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	let user: { email?: string | null } | null = null;

	try {
		const supabase = await createClient();
		const {
			data: { user: authUser }
		} = await supabase.auth.getUser();
		user = authUser;
	} catch {
		user = null;
	}

	return (
		<html lang="en">
			<body>
				<header className="border-b border-slate-200 bg-white">
					<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
						<Link href="/" className="text-lg font-bold text-slate-900">
							StormClose AI
						</Link>
						<nav className="flex items-center gap-3">
							{user ? (
								<Link href="/dashboard" className="button-secondary">
									Dashboard
								</Link>
							) : (
								<>
									<Link href="/login" className="button-secondary">
										Log in
									</Link>
									<Link href="/signup" className="button-primary">
										Sign up
									</Link>
								</>
							)}
						</nav>
					</div>
				</header>
				<main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
			</body>
		</html>
	);
}
