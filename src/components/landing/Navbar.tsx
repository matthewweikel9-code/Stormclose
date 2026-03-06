"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "./Logo";

const navLinks = [
	{ href: "#features", label: "Features" },
	{ href: "#pricing", label: "Pricing" },
	{ href: "#how-it-works", label: "How It Works" },
];

export function Navbar() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0B0F1A]/80 backdrop-blur-xl">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<Link href="/" className="flex items-center">
						<Logo />
					</Link>

					{/* Desktop Navigation */}
					<div className="hidden items-center gap-8 md:flex">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
							>
								{link.label}
							</Link>
						))}
					</div>

					{/* Desktop CTA */}
					<div className="hidden items-center gap-4 md:flex">
						<Link
							href="/login"
							className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
						>
							Login
						</Link>
						<Link
							href="/signup"
							className="rounded-lg bg-[#6D5CFF] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#5B4AE8] hover:shadow-lg hover:shadow-[#6D5CFF]/25"
						>
							Get Started
						</Link>
					</div>

					{/* Mobile Menu Button */}
					<button
						onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
						className="inline-flex items-center justify-center rounded-md p-2 text-slate-300 hover:text-white md:hidden"
						aria-label="Toggle menu"
					>
						<svg
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							{isMobileMenuOpen ? (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							) : (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							)}
						</svg>
					</button>
				</div>
			</div>

			{/* Mobile Menu */}
			<AnimatePresence>
				{isMobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="border-t border-white/5 bg-[#0B0F1A]/95 backdrop-blur-xl md:hidden"
					>
						<div className="space-y-1 px-4 py-4">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									onClick={() => setIsMobileMenuOpen(false)}
									className="block rounded-lg px-3 py-2 text-base font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
								>
									{link.label}
								</Link>
							))}
							<div className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4">
								<Link
									href="/login"
									className="rounded-lg px-3 py-2 text-center text-base font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
								>
									Login
								</Link>
								<Link
									href="/signup"
									className="rounded-lg bg-[#6D5CFF] px-3 py-2 text-center text-base font-semibold text-white transition-all hover:bg-[#5B4AE8]"
								>
									Get Started
								</Link>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</nav>
	);
}
