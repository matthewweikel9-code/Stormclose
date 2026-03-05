import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardPage() {
	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const { data: accountData } = (await supabase
		.from("users")
		.select("subscription_status")
		.eq("id", user.id)
		.maybeSingle()) as { data: { subscription_status: string | null } | null };

	const subscriptionStatus = accountData?.subscription_status ?? "inactive";

	return (
		<section className="mx-auto max-w-5xl space-y-6">
			<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
				<p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Dashboard</p>
				<h1 className="mt-2 text-3xl font-bold text-slate-900">Welcome back</h1>
				<p className="mt-3 text-slate-600">
					You are signed in as <span className="font-medium text-slate-900">{user.email}</span>.
				</p>

				<div className="mt-6 flex flex-wrap items-center gap-3">
					<span
						className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
							subscriptionStatus === "active"
								? "bg-emerald-100 text-emerald-700"
								: "bg-amber-100 text-amber-700"
						}`}
					>
						Subscription: {subscriptionStatus}
					</span>

					{subcriptionCta(subscriptionStatus)}

					<form action={logout}>
						<button type="submit" className="button-secondary">
							Log out
						</button>
					</form>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<Link
					href="/dashboard/report"
					className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow"
				>
					<p className="text-sm font-medium text-slate-500">Insurance Reports</p>
					<h2 className="mt-1 text-xl font-semibold text-slate-900">Generate report</h2>
					<p className="mt-2 text-sm text-slate-600">
						Create and save structured insurance-ready roof damage reports.
					</p>
					<p className="mt-4 text-sm font-semibold text-brand-700 group-hover:text-brand-600">
						Open report builder →
					</p>
				</Link>

				<Link
					href="/dashboard/followup"
					className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow"
				>
					<p className="text-sm font-medium text-slate-500">Customer Follow-ups</p>
					<h2 className="mt-1 text-xl font-semibold text-slate-900">Generate follow-up</h2>
					<p className="mt-2 text-sm text-slate-600">
						Create polished homeowner follow-up messages based on deal status.
					</p>
					<p className="mt-4 text-sm font-semibold text-brand-700 group-hover:text-brand-600">
						Open follow-up builder →
					</p>
				</Link>

				<Link
					href="/dashboard/objection"
					className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow"
				>
					<p className="text-sm font-medium text-slate-500">Sales Objections</p>
					<h2 className="mt-1 text-xl font-semibold text-slate-900">Craft responses</h2>
					<p className="mt-2 text-sm text-slate-600">
						Create clear, confident responses to common homeowner objections.
					</p>
					<p className="mt-4 text-sm font-semibold text-brand-700 group-hover:text-brand-600">
						Open objection builder →
					</p>
				</Link>
			</div>
		</section>
	);
}

function subcriptionCta(status: string) {
	if (status === "active") {
		return null;
	}

	return (
		<Link href="/subscribe" className="button-primary">
			Activate subscription
		</Link>
	);
}
