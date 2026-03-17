"use client";

import { DemoProvider } from "./DemoContext";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { SocialProof } from "./SocialProof";
import { ProductShowcase } from "./ProductShowcase";
import { FeatureGrid } from "./FeatureGrid";
import { StatsStrip } from "./StatsStrip";
import { HowItWorks } from "./HowItWorks";
import { Pricing } from "./Pricing";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

export function LandingContent() {
	return (
		<DemoProvider>
			<main className="min-h-screen bg-storm-bg">
				<Navbar />
				<Hero />
				<SocialProof />
				<ProductShowcase />
				<FeatureGrid />
				<StatsStrip />
				<HowItWorks />
				<Pricing />
				<CTA />
				<Footer />
			</main>
		</DemoProvider>
	);
}
