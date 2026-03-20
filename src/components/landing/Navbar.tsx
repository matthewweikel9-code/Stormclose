"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";
import { useDemoModal } from "./DemoContext";

const navLinks = [
	{ href: "#products", label: "Products" },
	{ href: "#features", label: "Features" },
	{ href: "#how-it-works", label: "How It Works" },
	{ href: "/pricing", label: "Pricing" },
];

export function Navbar() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const { openDemoModal } = useDemoModal();

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/40 bg-storm-z0/95 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link href="/" className="flex items-center">
					<Logo />
				</Link>

				<div className="hidden items-center gap-10 md:flex">
					{navLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
						>
							{link.label}
						</a>
					))}
				</div>

				<div className="hidden items-center gap-5 md:flex">
					<Link
						href="/pricing"
						className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
					>
						Pricing
					</Link>
					<Link
						href="/login"
						className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
					>
						Login
					</Link>
					<button
						onClick={openDemoModal}
						className="rounded-xl bg-storm-purple px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-storm-purple/20 transition-all hover:bg-storm-purple-hover hover:shadow-storm-purple/30"
					>
						Request Demo
					</button>
				</div>

				<button
					onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
					className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-800/50 hover:text-white md:hidden"
					aria-label="Menu"
				>
					<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						{isMobileMenuOpen ? (
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						) : (
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
						)}
					</svg>
				</button>
			</div>

			<AnimatePresence>
				{isMobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="border-t border-slate-800/40 bg-storm-z0/98 backdrop-blur-xl md:hidden"
					>
						<div className="space-y-1 px-4 py-6">
							{navLinks.map((link) => (
								<a
									key={link.href}
									href={link.href}
									onClick={() => setIsMobileMenuOpen(false)}
									className="block rounded-xl px-4 py-3 text-base font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-white"
								>
									{link.label}
								</a>
							))}
							<div className="mt-6 flex flex-col gap-3 border-t border-slate-800 pt-6">
								<Link
									href="/pricing"
									onClick={() => setIsMobileMenuOpen(false)}
									className="rounded-xl px-4 py-3 text-center font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-white"
								>
									Pricing
								</Link>
								<Link
									href="/login"
									onClick={() => setIsMobileMenuOpen(false)}
									className="rounded-xl px-4 py-3 text-center font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-white"
								>
									Login
								</Link>
								<button
									onClick={() => { setIsMobileMenuOpen(false); openDemoModal(); }}
									className="rounded-xl bg-storm-purple px-4 py-3 font-bold text-white"
								>
									Request Demo
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</nav>
	);
}
