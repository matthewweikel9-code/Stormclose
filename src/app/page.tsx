import {
	Navbar,
	Hero,
	Features,
	HowItWorks,
	Pricing,
	CTA,
	Footer,
} from "@/components/landing";

export default function HomePage() {
	return (
		<main className="min-h-screen bg-storm-bg">
			<Navbar />
			<Hero />
			<Features />
			<HowItWorks />
			<Pricing />
			<CTA />
			<Footer />
		</main>
	);
}
