import Link from "next/link";
import { Lock, Shield, Server, Key } from "lucide-react";

export const metadata = {
	title: "Security | StormClose AI",
	description: "Security practices and measures at StormClose AI.",
};

export default function SecurityPage() {
	return (
		<main className="min-h-screen bg-storm-bg">
			<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
				<Link href="/" className="inline-flex items-center gap-2 text-sm text-storm-muted hover:text-white mb-8">
					← Back to Home
				</Link>
				<div className="flex items-center gap-3 mb-8">
					<Lock className="h-10 w-10 text-storm-glow" />
					<h1 className="text-3xl font-bold text-white">Security</h1>
				</div>
				<p className="text-storm-muted text-sm mb-8">
					We take security seriously. Here&apos;s how we protect your data. For implementation and billing questions, see our{" "}
					<Link href="/faq" className="text-storm-glow hover:underline">FAQ for Buyers</Link>.
				</p>

				<div className="prose prose-invert prose-storm max-w-none space-y-8 text-storm-muted">
					<section className="flex gap-4">
						<Shield className="h-8 w-8 text-storm-glow shrink-0 mt-1" />
						<div>
							<h2 className="text-xl font-semibold text-white mb-2">Encryption</h2>
							<p>
								All data in transit is encrypted with TLS 1.3. Data at rest is encrypted using industry-standard
								AES encryption. API keys and integration credentials (JobNimbus, storm providers) are encrypted
								before storage and never stored in plain text.
							</p>
						</div>
					</section>

					<section className="flex gap-4">
						<Server className="h-8 w-8 text-storm-glow shrink-0 mt-1" />
						<div>
							<h2 className="text-xl font-semibold text-white mb-2">Infrastructure</h2>
							<p>
								We host on Vercel and Supabase, both SOC 2 compliant providers. Access to production systems
								is restricted and audited. We use Row Level Security (RLS) in our database so users can only
								access their own data.
							</p>
						</div>
					</section>

					<section className="flex gap-4">
						<Key className="h-8 w-8 text-storm-glow shrink-0 mt-1" />
						<div>
							<h2 className="text-xl font-semibold text-white mb-2">Authentication</h2>
							<p>
								We use Supabase Auth with secure session management. Passwords are hashed and never stored in
								plain text. Webhooks (Stripe, JobNimbus) validate signatures before processing. Cron jobs
								require a secret token.
							</p>
						</div>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">Third-Party Security</h2>
						<p>
							We integrate with Stripe (payments), JobNimbus (CRM), CoreLogic (property data), and Google
							APIs. We only request the minimum permissions needed and never store credentials beyond what
							is required for the integration to function.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">Reporting Vulnerabilities</h2>
						<p>
							If you discover a security vulnerability, please report it responsibly to{" "}
							<a href="mailto:security@stormclose.com" className="text-storm-glow hover:underline">
								security@stormclose.com
							</a>
							. We will acknowledge and address reports promptly.
						</p>
					</section>
				</div>

				<div className="mt-12 pt-8 border-t border-storm-border flex flex-wrap gap-6">
					<Link href="/faq" className="text-storm-glow hover:underline text-sm">FAQ for Buyers</Link>
					<Link href="/privacy" className="text-storm-glow hover:underline text-sm">Privacy Policy</Link>
					<Link href="/terms" className="text-storm-glow hover:underline text-sm">Terms of Service</Link>
					<Link href="/" className="text-storm-glow hover:underline text-sm">← Back to Home</Link>
				</div>
			</div>
		</main>
	);
}
