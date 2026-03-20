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
							<a href="#" className="text-slate-500 transition-colors hover:text-white" aria-label="Twitter">
								<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
							</a>
							<a href="#" className="text-slate-500 transition-colors hover:text-white" aria-label="LinkedIn">
								<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
							</a>
						</div>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Product</h3>
						<ul className="mt-6 space-y-4">
							<li><a href="#products" className="text-slate-400 hover:text-white">Storm Ops</a></li>
							<li><a href="#products" className="text-slate-400 hover:text-white">AI Image Engine</a></li>
							<li><a href="#products" className="text-slate-400 hover:text-white">Referral Engine</a></li>
							<li><a href="#pricing" className="text-slate-400 hover:text-white">Pricing</a></li>
							<li><button onClick={openDemoModal} className="text-slate-400 hover:text-white">Request Demo</button></li>
						</ul>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Company</h3>
						<ul className="mt-6 space-y-4">
							<li><Link href="/about" className="text-slate-400 hover:text-white">About</Link></li>
							<li><Link href="#" className="text-slate-400 hover:text-white">Blog</Link></li>
							<li><Link href="/contact" className="text-slate-400 hover:text-white">Contact</Link></li>
							<li><Link href="#" className="text-slate-400 hover:text-white">Careers</Link></li>
						</ul>
					</div>

					<div>
						<h3 className="text-sm font-bold uppercase tracking-wider text-white">Legal</h3>
						<ul className="mt-6 space-y-4">
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
