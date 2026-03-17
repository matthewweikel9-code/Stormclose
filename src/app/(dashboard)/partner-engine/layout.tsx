"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
	{ label: "Overview", href: "/partner-engine" },
	{ label: "Partners", href: "/partner-engine/partners" },
	{ label: "Referrals", href: "/partner-engine/referrals" },
	{ label: "Rewards", href: "/partner-engine/rewards" },
	{ label: "Settings", href: "/partner-engine/settings" },
];

export default function PartnerEngineLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="min-h-screen bg-storm-bg">
			<div className="border-b border-storm-border bg-storm-z0">
				<nav className="flex gap-1 px-6 pt-4">
					{tabs.map((tab) => {
						const isActive =
							tab.href === "/partner-engine"
								? pathname === "/partner-engine"
								: pathname.startsWith(tab.href);
						return (
							<Link
								key={tab.href}
								href={tab.href}
								className={`relative px-4 py-3 text-sm font-medium transition-colors ${
									isActive
										? "text-storm-glow"
										: "text-storm-muted hover:text-white"
								}`}
							>
								{tab.label}
								{isActive && (
									<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-storm-purple" />
								)}
							</Link>
						);
					})}
				</nav>
			</div>
			<main className="p-6">{children}</main>
		</div>
	);
}
