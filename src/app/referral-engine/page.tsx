import Link from "next/link";
import { Navbar, Footer, DemoProvider } from "@/components/landing";

const features = [
	{
		title: "Partner Operations",
		description: "Manage realtors, insurance agents, inspectors, and contractors with unique referral links, territory assignments, and tier-based performance tracking.",
	},
	{
		title: "Referral Pipeline",
		description: "Track referrals from submission through inspection, claim filing, approval, installation, and close with full lifecycle visibility.",
	},
	{
		title: "Revenue Attribution",
		description: "Connect Partner to Referral to Job to Revenue. See exactly which relationships generate the most contract value.",
	},
	{
		title: "CRM-First Workflow",
		description: "Push worked referrals to JobNimbus while preserving attribution and analytics in StormClose. One-click sync with error recovery.",
	},
	{
		title: "Reward Automation",
		description: "Auto-generate referral bonuses when roofs are installed. Track pending, approved, and paid rewards with a full audit trail.",
	},
	{
		title: "Storm-Triggered Activation",
		description: "When hail or wind is detected in your service area, automatically alert active partners with their referral link.",
	},
];

const metrics = [
	{ label: "Avg. close rate from referrals", value: "38%" },
	{ label: "Revenue per qualified referral", value: "$12,400" },
	{ label: "Avg. time from referral to install", value: "18 days" },
	{ label: "Partner retention after 6 months", value: "91%" },
];

export default function ReferralEnginePage() {
	return (
		<DemoProvider>
			<main className="min-h-screen bg-storm-bg">
				<Navbar />

			{/* Hero */}
			<section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-6xl">
					<div className="rounded-2xl border border-storm-border bg-gradient-to-br from-storm-z0 to-storm-z0/80 p-8 md:p-14">
						<div className="inline-flex items-center gap-2 rounded-full border border-storm-purple/30 bg-storm-purple/10 px-4 py-1.5 mb-6">
							<span className="h-2 w-2 rounded-full bg-storm-purple animate-pulse" />
							<span className="text-xs font-semibold text-storm-glow tracking-wide">Enterprise Add-on</span>
						</div>

						<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
							Referral Engine
						</h1>
						<p className="mt-5 max-w-3xl text-lg text-slate-300 leading-relaxed">
							Turn your partner network into a predictable lead pipeline. Activate
							referral sources after every storm, route opportunities to your CRM,
							and track partner-attributed revenue from submission to roof installed.
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								href="/signup?module=partner-engine"
								className="rounded-lg bg-storm-purple px-6 py-3 text-sm font-semibold text-white hover:bg-storm-purple-hover transition-all hover:shadow-lg hover:shadow-storm-purple/25"
							>
								Start Referral Engine
							</Link>
							<Link
								href="/partner-engine"
								className="rounded-lg border border-storm-border px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-storm-z1 transition-all"
							>
								Open In-App Module
							</Link>
							<Link
								href="/storm-intelligence"
								className="rounded-lg border border-storm-border px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-storm-z1 transition-all"
							>
								See Storm Intelligence
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Metrics strip */}
			<section className="px-4 sm:px-6 lg:px-8 pb-12">
				<div className="mx-auto max-w-6xl grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{metrics.map((m) => (
						<div key={m.label} className="rounded-xl border border-storm-border bg-storm-z0 p-5 text-center">
							<div className="text-2xl font-bold text-storm-glow">{m.value}</div>
							<div className="mt-1 text-xs text-storm-subtle">{m.label}</div>
						</div>
					))}
				</div>
			</section>

			{/* Features grid */}
			<section className="px-4 sm:px-6 lg:px-8 pb-16">
				<div className="mx-auto max-w-6xl">
					<h2 className="text-2xl font-bold text-white mb-8">Enterprise capabilities</h2>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{features.map((f) => (
							<div key={f.title} className="rounded-xl border border-storm-border bg-storm-z0 p-6 hover:border-storm-purple/30 transition-colors">
								<h3 className="text-white font-semibold">{f.title}</h3>
								<p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Workflow */}
			<section className="px-4 sm:px-6 lg:px-8 pb-16">
				<div className="mx-auto max-w-6xl">
					<div className="rounded-2xl border border-storm-border bg-storm-z0 p-8">
						<h2 className="text-xl font-bold text-white mb-6">How it works</h2>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
							{[
								{ step: "1", title: "Storm hits", desc: "Storm Intelligence detects hail/wind in your area." },
								{ step: "2", title: "Partners notified", desc: "Active partners receive alerts with their referral links." },
								{ step: "3", title: "Referrals flow in", desc: "Partners submit homeowner addresses through their unique link." },
								{ step: "4", title: "Jobs close", desc: "Your team inspects, files, and installs. Revenue is attributed." },
								{ step: "5", title: "Rewards tracked", desc: "Partner bonuses auto-calculate and enter the payout queue." },
							].map((s) => (
								<div key={s.step} className="text-center">
									<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-storm-purple/15 text-sm font-bold text-storm-glow">
										{s.step}
									</div>
									<h4 className="mt-2 text-sm font-semibold text-white">{s.title}</h4>
									<p className="mt-1 text-xs text-storm-subtle leading-relaxed">{s.desc}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="px-4 sm:px-6 lg:px-8 pb-20">
				<div className="mx-auto max-w-6xl text-center">
					<h2 className="text-2xl font-bold text-white">Ready to grow your referral network?</h2>
					<p className="mt-3 text-slate-400">
						Start with a free trial. No credit card required.
					</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<Link
							href="/signup?module=partner-engine"
							className="rounded-lg bg-storm-purple px-8 py-3.5 text-sm font-semibold text-white hover:bg-storm-purple-hover transition-all hover:shadow-lg hover:shadow-storm-purple/25"
						>
							Get Started Free
						</Link>
						<Link
							href="/pricing"
							className="rounded-lg border border-storm-border px-8 py-3.5 text-sm font-semibold text-slate-200 hover:bg-storm-z1 transition-all"
						>
							View Pricing
						</Link>
					</div>
				</div>
			</section>

				<Footer />
			</main>
		</DemoProvider>
	);
}
