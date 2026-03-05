import Link from "next/link";

export default function HomePage() {
	return (
		<section className="mx-auto max-w-3xl text-center">
			<p className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
				Roofing SaaS
			</p>
			<h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
				Close more roofing jobs with StormClose AI
			</h1>
			<p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
				Fast estimates, AI-assisted workflows, and one dashboard for your roofing team.
			</p>
			<div className="mt-8 flex items-center justify-center gap-3">
				<Link href="/signup" className="button-primary">
					Create account
				</Link>
				<Link href="/login" className="button-secondary">
					Log in
				</Link>
			</div>
		</section>
	);
}
