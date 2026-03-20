import Link from "next/link";
import { HelpCircle, Shield, CreditCard, Zap, Database } from "lucide-react";

export const metadata = {
	title: "FAQ for Buyers | StormClose AI",
	description: "Frequently asked questions about StormClose AI — data sources, integrations, billing, and implementation.",
};

const faqs = [
	{
		category: "Data & Integrations",
		icon: Database,
		items: [
			{
				q: "What data sources does StormClose use?",
				a: "We use CoreLogic for property data, XWeather for storm/hail events, NOAA for historical hail, and Google Maps for geocoding and routing. AI analysis uses OpenAI. All data is processed securely and we only request the minimum permissions needed.",
			},
			{
				q: "Does StormClose integrate with JobNimbus?",
				a: "Yes. Pro and Enterprise plans include JobNimbus sync. You can export leads, mission stops, and documents directly to your JobNimbus account. Connect once in Company settings.",
			},
			{
				q: "Where is my data stored?",
				a: "We host on Supabase (database) and Vercel (application), both SOC 2 compliant. Data is encrypted in transit (TLS) and at rest (AES). API keys and credentials are encrypted before storage.",
			},
		],
	},
	{
		category: "Billing & Subscription",
		icon: CreditCard,
		items: [
			{
				q: "How does the 7-day trial work?",
				a: "Start a Pro or Enterprise trial with no charge for 7 days. Card required. Cancel anytime before the trial ends — you won't be charged. After 7 days, your plan renews at the monthly rate unless you cancel.",
			},
			{
				q: "How do I cancel?",
				a: "Go to Settings → Billing and click Manage. You'll be taken to the Stripe customer portal where you can cancel or update your subscription. Cancellation takes effect at the end of your current billing period.",
			},
			{
				q: "What's the refund policy?",
				a: "We don't offer prorated refunds for partial months. If you cancel, you keep access until the end of your paid period. For billing issues, contact support@stormclose.com.",
			},
		],
	},
	{
		category: "Implementation & Support",
		icon: Zap,
		items: [
			{
				q: "How long does setup take?",
				a: "Most teams are up and running in under 15 minutes. Create an account, connect JobNimbus (optional), set your default location, and open Storm Ops. The dashboard guides you through the first steps.",
			},
			{
				q: "What support do you offer?",
				a: "Pro includes email support. Enterprise includes dedicated support. For security or compliance questions, see our Security page or email security@stormclose.com.",
			},
		],
	},
];

export default function FAQPage() {
	return (
		<main className="min-h-screen bg-storm-bg">
			<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
				<Link href="/" className="inline-flex items-center gap-2 text-sm text-storm-muted hover:text-white mb-8">
					← Back to Home
				</Link>
				<div className="flex items-center gap-3 mb-10">
					<HelpCircle className="h-10 w-10 text-storm-glow" />
					<h1 className="text-3xl font-bold text-white">FAQ for Buyers</h1>
				</div>
				<p className="text-storm-muted text-sm mb-12">
					Common questions about data, integrations, billing, and implementation. For full details, see our{" "}
					<Link href="/privacy" className="text-storm-glow hover:underline">Privacy</Link>,{" "}
					<Link href="/terms" className="text-storm-glow hover:underline">Terms</Link>, and{" "}
					<Link href="/security" className="text-storm-glow hover:underline">Security</Link> pages.
				</p>

				<div className="space-y-12">
					{faqs.map((section) => {
						const Icon = section.icon;
						return (
							<section key={section.category}>
								<div className="flex items-center gap-2 mb-6">
									<Icon className="h-5 w-5 text-storm-glow" />
									<h2 className="text-lg font-semibold text-white">{section.category}</h2>
								</div>
								<div className="space-y-6">
									{section.items.map((faq) => (
										<div key={faq.q} className="rounded-xl border border-storm-border bg-storm-z0/50 p-5">
											<h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
											<p className="text-sm text-storm-muted leading-relaxed">{faq.a}</p>
										</div>
									))}
								</div>
							</section>
						);
					})}
				</div>

				<div className="mt-16 rounded-xl border border-storm-purple/30 bg-storm-purple/5 p-6">
					<div className="flex items-center gap-3 mb-3">
						<Shield className="h-6 w-6 text-storm-glow" />
						<h3 className="text-lg font-semibold text-white">Security & Compliance</h3>
					</div>
					<p className="text-sm text-storm-muted mb-4">
						We use industry-standard encryption, SOC 2 compliant infrastructure, and Row Level Security for data isolation.
						API keys and integration credentials are encrypted. Webhooks validate signatures. Cron jobs require a secret token.
					</p>
					<div className="flex flex-wrap gap-3">
						<Link href="/security" className="text-sm font-medium text-storm-glow hover:text-storm-purple">
							Security details →
						</Link>
						<Link href="/privacy" className="text-sm font-medium text-storm-glow hover:text-storm-purple">
							Privacy Policy →
						</Link>
						<Link href="/terms" className="text-sm font-medium text-storm-glow hover:text-storm-purple">
							Terms of Service →
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
