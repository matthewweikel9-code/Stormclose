import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import { PhotosClient } from "./photos-client";

export default async function PhotosPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	// Check if user has access to photo analysis (Pro+ only)
	const access = await checkFeatureAccess(user.id, "photo_analysis");

	if (!access.allowed) {
		return (
			<section className="mx-auto max-w-2xl py-12 text-center">
				<div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#6D5CFF]/10">
					<svg
						className="h-8 w-8 text-[#A78BFA]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
						/>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</div>
				<h1 className="mb-4 text-2xl font-bold text-white">
					AI Photo Analysis is a Pro+ Feature
				</h1>
				<p className="mb-8 text-slate-400">
					Upload roof damage photos and get instant AI-powered analysis to strengthen your
					insurance claims. Our AI detects damage types, assesses severity, and provides
					documentation-ready descriptions.
				</p>
				<div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
					<Link
						href="/settings/billing"
						className="inline-flex items-center justify-center rounded-xl bg-[#6D5CFF] px-6 py-3 font-semibold text-white transition-all hover:bg-[#5B4DE0]"
					>
						Upgrade to Pro+
					</Link>
					<Link
						href="/dashboard"
						className="inline-flex items-center justify-center rounded-xl border border-[#1F2937] bg-[#111827] px-6 py-3 font-medium text-slate-300 transition-all hover:bg-[#1F2937]"
					>
						Back to Dashboard
					</Link>
				</div>
			</section>
		);
	}

	return <PhotosClient />;
}
