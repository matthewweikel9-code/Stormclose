"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function ContactPage() {
	useEffect(() => {
		// Redirect to demo request if coming from landing
		const fromLanding = typeof window !== "undefined" && document.referrer?.includes(window.location.origin);
		if (fromLanding) {
			// Let user see the page - they clicked Contact
		}
	}, []);

	return (
		<main className="min-h-screen bg-storm-bg flex items-center justify-center px-4">
			<div className="max-w-lg w-full text-center">
				<div className="rounded-2xl border border-storm-border bg-storm-z0 p-8">
					<Mail className="h-12 w-12 text-storm-glow mx-auto mb-4" />
					<h1 className="text-2xl font-bold text-white">Contact Us</h1>
					<p className="mt-3 text-storm-muted text-sm">
						Have questions or want to schedule a demo? We&apos;d love to hear from you.
					</p>
					<div className="mt-6 space-y-3">
						<a
							href="mailto:support@stormclose.com"
							className="block w-full rounded-lg bg-storm-purple px-6 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover transition-all"
						>
							Email support@stormclose.com
						</a>
						<Link
							href="/"
							className="flex items-center justify-center gap-2 w-full rounded-lg border border-storm-border px-6 py-3 text-sm font-medium text-storm-muted hover:bg-storm-z2 hover:text-white transition-all"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Home
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
