import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import { FollowupClient } from "./followup-client";

export default async function FollowupPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	// Check if user has access to email generation (Pro or Pro+)
	const access = await checkFeatureAccess(user.id, "email_generation");

	if (!access.allowed) {
		return (
			<section className="saas-shell">
				<div className="mx-auto max-w-2xl text-center">
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
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					</div>
					<h1 className="mb-4 text-2xl font-bold text-white">
						Follow-up Builder is a Pro Feature
					</h1>
					<p className="mb-8 text-slate-400">
						Generate professional, personalized follow-up messages for homeowners based on their
						deal status. Upgrade to Pro to unlock this feature.
					</p>
					<div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
						<Link
							href="/settings/billing"
							className="inline-flex items-center justify-center rounded-xl bg-[#6D5CFF] px-6 py-3 font-semibold text-white transition-all hover:bg-[#5B4DE0]"
						>
							Upgrade to Pro
						</Link>
						<Link
							href="/dashboard"
							className="inline-flex items-center justify-center rounded-xl border border-[#1F2937] bg-[#111827] px-6 py-3 font-medium text-slate-300 transition-all hover:bg-[#1F2937]"
						>
							Back to Dashboard
						</Link>
					</div>
				</div>
			</section>
		);
	}

	return <FollowupClient />;
}
