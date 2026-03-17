import Link from "next/link";
import { Navbar, Footer, DemoProvider } from "@/components/landing";

export default function StormIntelligencePage() {
	return (
		<DemoProvider>
		<main className="min-h-screen bg-storm-bg">
			<Navbar />
			<section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-6xl">
					<div className="rounded-2xl border border-storm-border bg-storm-z0 p-8 md:p-12">
						<p className="text-xs tracking-[0.2em] uppercase text-storm-glow mb-3">Core product</p>
						<h1 className="text-4xl md:text-5xl font-bold text-white">Storm Intelligence</h1>
						<p className="mt-4 max-w-3xl text-slate-300">
							Monitor hail and wind events, deploy teams to high-impact zones, and run
							field operations from a single command center.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								href="/signup?next=/dashboard/storm-map"
								className="rounded-lg bg-storm-purple px-5 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover"
							>
								Start Storm Intelligence
							</Link>
							<Link
								href="/dashboard/storm-map"
								className="rounded-lg border border-storm-border px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-storm-z1"
							>
								Open Storm Ops
							</Link>
							<Link
								href="/referral-engine"
								className="rounded-lg border border-storm-border px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-storm-z1"
							>
								Explore Referral Engine
							</Link>
						</div>
					</div>
				</div>
			</section>
			<Footer />
		</main>
		</DemoProvider>
	);
}
