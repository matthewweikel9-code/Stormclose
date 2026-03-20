import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
	title: "Terms of Service | StormClose AI",
	description: "Terms of service for StormClose AI.",
};

export default function TermsPage() {
	return (
		<main className="min-h-screen bg-storm-bg">
			<div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
				<Link href="/" className="inline-flex items-center gap-2 text-sm text-storm-muted hover:text-white mb-8">
					← Back to Home
				</Link>
				<div className="flex items-center gap-3 mb-8">
					<FileText className="h-10 w-10 text-storm-glow" />
					<h1 className="text-3xl font-bold text-white">Terms of Service</h1>
				</div>
				<p className="text-storm-muted text-sm mb-8">Last updated: {new Date().toLocaleDateString("en-US")}</p>

				<div className="prose prose-invert prose-storm max-w-none space-y-6 text-storm-muted">
					<section>
						<h2 className="text-xl font-semibold text-white mb-3">1. Agreement</h2>
						<p>
							By accessing or using StormClose AI (&quot;Service&quot;), you agree to these Terms of Service.
							If you are using the Service on behalf of an organization, you represent that you have authority
							to bind that organization.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">2. Use of Service</h2>
						<p>
							You agree to use the Service only for lawful purposes and in accordance with these Terms. You
							may not misuse the Service, attempt to gain unauthorized access, interfere with other users, or
							use it in any way that could harm the Service or our infrastructure.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">3. Account and Billing</h2>
						<p>
							You are responsible for maintaining the confidentiality of your account credentials. Paid
							subscriptions are billed in advance. You may cancel at any time; refunds are handled per our
							billing policy. We may change pricing with notice.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">4. Intellectual Property</h2>
						<p>
							StormClose AI and its content, features, and functionality are owned by us and are protected
							by copyright, trademark, and other laws. You may not copy, modify, or create derivative works
							without our permission.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
						<p>
							The Service may integrate with third-party services (e.g., JobNimbus, Stripe). Your use of those
							services is subject to their respective terms. We are not responsible for third-party services.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">6. Disclaimer</h2>
						<p>
							The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
							uninterrupted or error-free operation. Storm data, property data, and AI outputs are for
							informational purposes; you are responsible for verifying accuracy.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">7. Limitation of Liability</h2>
						<p>
							To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or
							consequential damages arising from your use of the Service. Our total liability is limited to the
							amount you paid us in the twelve months preceding the claim.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">8. Termination</h2>
						<p>
							We may suspend or terminate your access for violation of these Terms or for any other reason.
							You may terminate your account at any time. Upon termination, your right to use the Service
							ceases immediately.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">9. Changes</h2>
						<p>
							We may update these Terms from time to time. We will notify you of material changes via email
							or in-app notice. Continued use after changes constitutes acceptance.
						</p>
					</section>

					<section>
						<h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
						<p>
							Questions? Email{" "}
							<a href="mailto:legal@stormclose.com" className="text-storm-glow hover:underline">
								legal@stormclose.com
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
