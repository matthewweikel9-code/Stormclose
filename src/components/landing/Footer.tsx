"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useDemoModal } from "./DemoContext";

export function Footer() {
	const { openDemoModal } = useDemoModal();

	return (
		<footer className="border-t border-slate-800/30 bg-storm-z0">
			<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
				<div className="grid gap-12 lg:grid-cols-5">
					<div className="lg:col-span-2">
						<Logo />
						<p className="mt-6 max-w-sm text-base text-slate-400 leading-relaxed">
							The AI platform built for storm roofing teams. From live hail tracking to closed deals.
						</p>
						<div className="mt-8 flex items-center gap-5">
							<a href="mailto:support@stormclose.com" className="text-slate-500 transition-colors hover:text-white" aria-label="Email">
								<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
							</a>
						</div>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Product</h3>
						<ul className="mt-6 space-y-4">
							<li><a href="#products" className="text-slate-400 hover:text-white">Storm Ops</a></li>
							<li><a href="#products" className="text-slate-400 hover:text-white">AI Image Engine</a></li>
							<li><a href="#products" className="text-slate-400 hover:text-white">Referral Engine</a></li>
							<li><Link href="/pricing" className="text-slate-400 hover:text-white">Pricing</Link></li>
							<li><button onClick={openDemoModal} className="text-slate-400 hover:text-white">Request Demo</button></li>
						</ul>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Company</h3>
						<ul className="mt-6 space-y-4">
							<li><Link href="/contact" className="text-slate-400 hover:text-white">Contact</Link></li>
							<li><button onClick={openDemoModal} className="text-slate-400 hover:text-white">Request Demo</button></li>
						</ul>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Legal & Trust</h3>
						<ul className="mt-6 space-y-4">
							<li><Link href="/faq" className="text-slate-400 hover:text-white">FAQ for Buyers</Link></li>
							<li><Link href="/privacy" className="text-slate-400 hover:text-white">Privacy</Link></li>
							<li><Link href="/terms" className="text-slate-400 hover:text-white">Terms</Link></li>
							<li><Link href="/security" className="text-slate-400 hover:text-white">Security</Link></li>
						</ul>
						<div className="mt-8">
							<h3 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h3>
							<a href="mailto:support@stormclose.com" className="mt-4 block text-slate-400 hover:text-white">
								support@stormclose.com
							</a>
						</div>
					</div>
				</div>

				<div className="mt-16 border-t border-slate-800/30 pt-10">
					<p className="text-center text-sm text-slate-500">
						© {new Date().getFullYear()} StormClose AI. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	);
}
