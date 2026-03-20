"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Users, ArrowRight, Shield, Award, Settings } from "lucide-react";

const tabs = [
	{ label: "Overview", href: "/partner-engine", icon: TrendingUp },
	{ label: "Partners", href: "/partner-engine/partners", icon: Users },
	{ label: "Referrals", href: "/partner-engine/referrals", icon: ArrowRight },
	{ label: "Trust Graph", href: "/partner-engine/trust-graph", icon: Shield },
	{ label: "Rewards", href: "/partner-engine/rewards", icon: Award },
	{ label: "Settings", href: "/partner-engine/settings", icon: Settings },
];

export function PartnerEngineTabs({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div>
			<div className="mb-6 glass rounded-2xl p-1.5 overflow-x-auto scrollbar-hide">
				<nav className="flex items-center gap-1">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive =
							tab.href === "/partner-engine"
								? pathname === "/partner-engine"
								: pathname.startsWith(tab.href);
						return (
							<Link
								key={tab.href}
								href={tab.href}
								className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
									isActive
										? "bg-storm-purple/15 text-storm-glow shadow-glow-sm"
										: "text-storm-muted hover:bg-storm-z2/60 hover:text-white"
								}`}
							>
								<Icon className={`h-4 w-4 ${isActive ? "text-storm-glow" : ""}`} />
								{tab.label}
								{isActive && (
									<span className="absolute inset-x-3 -bottom-[7px] h-[2px] rounded-full bg-gradient-to-r from-storm-purple to-storm-glow" />
								)}
							</Link>
						);
					})}
				</nav>
			</div>
			<main>{children}</main>
		</div>
	);
}
