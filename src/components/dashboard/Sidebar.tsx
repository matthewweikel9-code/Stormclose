"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";

export interface SidebarProps {
	subscriptionTier?: SubscriptionTier;
	daysUntilTrialEnd?: number | null;
}

export function Sidebar({ subscriptionTier = "free", daysUntilTrialEnd }: SidebarProps) {
	const pathname = usePathname();
	const displayTier = TIER_DISPLAY_NAMES[subscriptionTier] || "Free";

	const getTierBadgeStyle = () => {
		switch (subscriptionTier) {
			case "enterprise":
				return "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400";
			case "pro_plus":
				return "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400";
			case "pro":
				return "bg-[#6D5CFF]/20 text-[#A78BFA]";
			default:
				return "bg-slate-700/50 text-slate-400";
		}
	};

	const navItems = [
		{
			label: "Dashboard",
			href: "/dashboard",
			exact: true,
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			),
			description: "Overview & KPIs",
		},
		{
			label: "Command Center",
			href: "/dashboard/command-center",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
				</svg>
			),
			badge: "🔴 LIVE",
			badgeStyle: "bg-red-500/20 text-red-400 animate-pulse",
			description: "Storm Map, Leads, Routes",
		},
		{
			label: "AI Tools",
			href: "/dashboard/ai-tools",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
			),
			badge: "AI",
			badgeStyle: "bg-[#6D5CFF]/20 text-[#A78BFA]",
			description: "Objections, Negotiation, Carriers",
		},
		{
			label: "Documents",
			href: "/dashboard/documents",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			),
			description: "Estimates, Roof, Reports",
		},
		{
			label: "Team",
			href: "/dashboard/team",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
				</svg>
			),
			badge: "Enterprise",
			badgeStyle: "bg-emerald-500/20 text-emerald-400",
			description: "Performance, Field Map, CRM",
		},
		{
			label: "Settings",
			href: "/settings/billing",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			),
			description: "Profile, Billing, Team",
		},
	];

	return (
		<aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#1F2937] bg-[#0B0F1A]">
			{/* Logo */}
			<div className="flex h-16 items-center border-b border-[#1F2937] px-6">
				<Link href="/">
					<Logo />
				</Link>
			</div>

			{/* Subscription Badge */}
			<div className="border-b border-[#1F2937] px-4 py-3">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium text-slate-400">Plan</span>
					<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTierBadgeStyle()}`}>
						{displayTier}
					</span>
				</div>
				{daysUntilTrialEnd !== null && daysUntilTrialEnd !== undefined && daysUntilTrialEnd > 0 && (
					<p className="mt-1 text-xs text-amber-400">
						Trial ends in {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? "s" : ""}
					</p>
				)}
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
				{navItems.map((item) => {
					const isActive = item.exact
						? pathname === item.href
						: pathname.startsWith(item.href);

					// Team requires enterprise
					if (item.label === "Team" && subscriptionTier !== "enterprise") {
						return (
							<div
								key={item.href}
								className="group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 cursor-not-allowed"
							>
								<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111827] text-slate-600">
									{item.icon}
								</span>
								<div className="flex-1 min-w-0">
									<span className="block text-slate-600">{item.label}</span>
									<span className="block text-[10px] text-slate-700">{item.description}</span>
								</div>
								{item.badge && (
									<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeStyle}`}>
										{item.badge}
									</span>
								)}
								{/* Locked overlay tooltip */}
								<div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-[#0B0F1A]/80">
									<span className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 shadow-lg border border-slate-700">
										🔒 Enterprise Only
									</span>
								</div>
							</div>
						);
					}

					return (
						<Link
							key={item.href}
							href={item.href}
							className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
								isActive
									? "bg-gradient-to-r from-[#6D5CFF]/15 to-[#A78BFA]/10 text-white shadow-lg shadow-[#6D5CFF]/5"
									: "text-slate-400 hover:bg-[#1E293B]/60 hover:text-white"
							}`}
						>
							{/* Active indicator bar */}
							{isActive && (
								<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#6D5CFF]" />
							)}

							<span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
								isActive
									? "bg-[#6D5CFF]/20 text-[#A78BFA]"
									: "bg-[#111827] text-slate-500 group-hover:bg-[#1E293B] group-hover:text-slate-300"
							}`}>
								{item.icon}
							</span>

							<div className="flex-1 min-w-0">
								<span className={`block ${isActive ? "text-white" : ""}`}>{item.label}</span>
								<span className={`block text-[10px] ${isActive ? "text-[#A78BFA]/70" : "text-slate-600"}`}>
									{item.description}
								</span>
							</div>

							{item.badge && (
								<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.badgeStyle}`}>
									{item.badge}
								</span>
							)}
						</Link>
					);
				})}
			</nav>

			{/* Bottom section */}
			<div className="border-t border-[#1F2937] p-4">
				{subscriptionTier !== "enterprise" ? (
					<div className="rounded-xl bg-gradient-to-r from-[#6D5CFF]/10 to-[#A78BFA]/10 p-4">
						<p className="text-sm font-medium text-white">
							{subscriptionTier === "free" && "Upgrade to Pro"}
							{subscriptionTier === "trial" && "Upgrade to Pro"}
							{subscriptionTier === "pro" && "Upgrade to Pro+"}
							{subscriptionTier === "pro_plus" && "Upgrade to Enterprise"}
						</p>
						<p className="mt-1 text-xs text-slate-400">
							{subscriptionTier === "free" && "Unlock AI-powered sales tools."}
							{subscriptionTier === "trial" && "Keep your access after trial ends."}
							{subscriptionTier === "pro" && "Get Supplement AI & Negotiation Coach."}
							{subscriptionTier === "pro_plus" && "Full access to Team tools & Carrier Intel."}
						</p>
						<Link
							href="/settings/billing"
							className="mt-3 inline-flex text-xs font-medium text-[#A78BFA] hover:text-[#6D5CFF] transition-colors"
						>
							View Plans →
						</Link>
					</div>
				) : (
					<div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
						<p className="text-sm font-medium text-white">Enterprise Member</p>
						<p className="mt-1 text-xs text-slate-400">
							You have access to all features.
						</p>
						<Link
							href="/contact"
							className="mt-3 inline-flex text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
						>
							Priority Support →
						</Link>
					</div>
				)}
			</div>
		</aside>
	);
}