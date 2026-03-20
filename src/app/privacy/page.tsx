import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
	title: "Privacy Policy | StormClose AI",
	description: "Privacy policy for StormClose AI - how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
	return (
		<main className="min-h-screen bg-storm-bg">
			<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
				<Link href="/" className="inline-flex items-center gap-2 text-sm text-storm-muted hover:text-white mb-8">
					← Back to Home
				</Link>
				<div className="flex items-center gap-3 mb-8">
					<Shield className="h-10 w-10 text-storm-glow" />
					<h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
				</div>
				<p className="text-storm-muted text-sm mb-8">Last updated: {new Date().toLocaleDateString("en-US")}</p>

				<div className="prose prose-invert prose-storm max-w-none space-y-6 text-storm-muted">
					<section>
						<h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
						<p>
							We collect information you provide directly (account details, company info, contact information),
							usage data (how you use our platform), and technical data (IP address, browser type, device info).
							When you connect integrations (JobNimbus, storm providers), we store credentials securely and use
							them only to provide the services you request.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
						<p>
							We use your data to operate and improve StormClose AI, process transactions, send service-related
							communications, provide customer support, and comply with legal obligations. We do not sell your
							personal information.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
						<p>
							We share data only with service providers who assist our operations (hosting, payment processing,
							email delivery) under strict agreements. We may share aggregated, anonymized data for analytics.
							We do not share your personal data with third parties for their marketing.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
						<p>
							We use industry-standard encryption (TLS, AES) for data in transit and at rest. API keys and
							credentials are encrypted. Access is restricted to authorized personnel. See our{" "}
							<Link href="/security" className="text-storm-glow hover:underline">Security</Link> page for more.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
						<p>
							We retain your data for as long as your account is active or as needed to provide services.
							You may request deletion of your account and associated data at any time by contacting
							support@stormclose.com.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
						<p>
							You may access, correct, or delete your personal data through your account settings or by
							contacting us. EU/UK residents have additional rights under GDPR. California residents have
							rights under CCPA.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
						<p>
							We use essential cookies for authentication and session management. We may use analytics cookies
							to improve our product. You can manage cookie preferences in your browser.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
						<p>
							Questions about this policy? Email{" "}
							<a href="mailto:privacy@stormclose.com" className="text-storm-glow hover:underline">
								privacy@stormclose.com
							</a>
							.
						</p>
					</section>
				</div>

				<div className="mt-12 pt-8 border-t border-storm-border">
					<Link href="/" className="text-storm-glow hover:underline text-sm">← Back to Home</Link>
				</div>
			</div>
		</main>
	);
}
