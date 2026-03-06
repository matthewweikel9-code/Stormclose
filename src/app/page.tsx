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
		<main className="min-h-screen bg-[#0B0F1A]">
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
