"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";

export interface SidebarProps {
	subscriptionTier?: SubscriptionTier;
	daysUntilTrialEnd?: number | null;
}

export function Sidebar({ subscriptionTier = "free", daysUntilTrialEnd }: SidebarProps) {
	const pathname = usePathname();
	const [expanded, setExpanded] = useState(false);
	const displayTier = TIER_DISPLAY_NAMES[subscriptionTier] || "Free";

	const getTierBadgeVariant = (): "success" | "warning" | "purple" | "default" => {
		switch (subscriptionTier) {
			case "enterprise": return "success";
			case "pro_plus": return "warning";
			case "pro": return "purple";
			default: return "default";
		}
	};

	const navItems = [
		{
			label: "Revenue Hub",
			href: "/dashboard",
			exact: true,
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			),
		},
		{
			label: "Storm Ops",
			href: "/dashboard/command-center",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
				</svg>
			),
			badge: "LIVE",
			badgeVariant: "live" as const,
		},
		{
			label: "AI Assistant",
			href: "/dashboard/ai-tools",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
			),
			badge: "AI",
			badgeVariant: "purple" as const,
		},
		{
			label: "Deal Desk",
			href: "/dashboard/documents",
			icon: (
				<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			),
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
			badgeVariant: "success" as const,
			requiresEnterprise: true,
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
		},
	];

	return (
		<aside
			onMouseEnter={() => setExpanded(true)}
			onMouseLeave={() => setExpanded(false)}
			className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-storm-border bg-storm-z0 transition-all duration-300 ease-in-out ${
				expanded ? "w-[16.5rem]" : "w-[4.5rem]"
			}`}
		>
			{/* Logo */}
			<div className="flex h-16 items-center border-b border-storm-border px-4 overflow-hidden">
				<Link href="/" className="flex-shrink-0">
					<Logo showText={expanded} />
				</Link>
			</div>

			{/* Tier badge — only when expanded */}
			<div className={`border-b border-storm-border overflow-hidden transition-all duration-300 ${
				expanded ? "px-4 py-3 opacity-100 max-h-16" : "max-h-0 opacity-0 py-0 px-0"
			}`}>
				<div className="flex items-center justify-between">
					<span className="text-2xs font-medium text-storm-subtle uppercase tracking-wider">Plan</span>
					<Badge variant={getTierBadgeVariant()}>{displayTier}</Badge>
				</div>
				{daysUntilTrialEnd !== null && daysUntilTrialEnd !== undefined && daysUntilTrialEnd > 0 && (
					<p className="mt-1 text-2xs text-amber-400">
						Trial ends in {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? "s" : ""}
					</p>
				)}
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1">
				{navItems.map((item) => {
					const isActive = item.exact
						? pathname === item.href
						: pathname.startsWith(item.href);

					const isLocked = item.requiresEnterprise && subscriptionTier !== "enterprise";

					const navContent = (
						<>
							{/* Active indicator */}
							{isActive && (
								<div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-storm-purple shadow-glow-sm" />
							)}

							{/* Icon */}
							<span
								className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
									isActive
										? "bg-storm-purple/15 text-storm-glow"
										: isLocked
										? "bg-storm-z1 text-storm-subtle/50"
										: "bg-storm-z1 text-storm-subtle group-hover:bg-storm-z2 group-hover:text-storm-muted"
								}`}
							>
								{item.icon}
							</span>

							{/* Label — slides in when expanded */}
							<div
								className={`flex-1 min-w-0 flex items-center justify-between transition-all duration-300 ${
									expanded ? "opacity-100 ml-3" : "opacity-0 ml-0 w-0 overflow-hidden"
								}`}
							>
								<span
									className={`text-sm font-medium truncate ${
										isActive ? "text-white" : isLocked ? "text-storm-subtle/50" : ""
									}`}
								>
									{item.label}
								</span>
								{item.badge && expanded && (
									<Badge variant={item.badgeVariant || "default"} className="ml-2">
										{item.badge === "LIVE" && <span className="status-dot-live mr-1" />}
										{item.badge}
									</Badge>
								)}
							</div>
						</>
					);

					// Locked team item
					if (isLocked) {
						const inner = (
							<div className="group relative flex items-center rounded-xl px-2 py-2.5 text-sm font-medium text-storm-subtle/50 cursor-not-allowed">
								{navContent}
							</div>
						);

						return expanded ? (
							<div key={item.href}>{inner}</div>
						) : (
							<Tooltip key={item.href} content="🔒 Enterprise Only" side="right">
								{inner}
							</Tooltip>
						);
					}

					const link = (
						<Link
							key={item.href}
							href={item.href}
							className={`group relative flex items-center rounded-xl px-2 py-2.5 text-sm font-medium transition-all duration-200 ${
								isActive
									? "bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 text-white"
									: "text-storm-muted hover:bg-storm-z2/60 hover:text-white"
							}`}
						>
							{navContent}
						</Link>
					);

					// Show tooltip only when collapsed
					return expanded ? (
						<div key={item.href}>{link}</div>
					) : (
						<Tooltip key={item.href} content={item.label} side="right">
							{link}
						</Tooltip>
					);
				})}
			</nav>

			{/* Glow separator */}
			<div className="glow-line mx-4" />

			{/* Bottom section */}
			<div className={`p-3 transition-all duration-300 overflow-hidden ${
				expanded ? "opacity-100 max-h-40" : "opacity-0 max-h-0 p-0"
			}`}>
				{subscriptionTier !== "enterprise" ? (
					<div className="rounded-xl bg-gradient-to-r from-storm-purple/8 to-storm-glow/5 border border-storm-purple/10 p-3.5">
						<p className="text-xs font-semibold text-white">
							{subscriptionTier === "free" && "Upgrade to Pro"}
							{subscriptionTier === "trial" && "Upgrade to Pro"}
							{subscriptionTier === "pro" && "Upgrade to Pro+"}
							{subscriptionTier === "pro_plus" && "Go Enterprise"}
						</p>
						<p className="mt-1 text-2xs text-storm-subtle leading-relaxed">
							{subscriptionTier === "free" && "Unlock AI-powered sales tools."}
							{subscriptionTier === "trial" && "Keep access after trial ends."}
							{subscriptionTier === "pro" && "Get Supplement AI & Negotiation."}
							{subscriptionTier === "pro_plus" && "Full Team tools & Carrier Intel."}
						</p>
						<Link
							href="/settings/billing"
							className="mt-2 inline-flex text-2xs font-semibold text-storm-glow hover:text-storm-purple transition-colors"
						>
							View Plans →
						</Link>
					</div>
				) : (
					<div className="rounded-xl bg-gradient-to-r from-emerald-500/8 to-teal-500/5 border border-emerald-500/10 p-3.5">
						<p className="text-xs font-semibold text-white">Enterprise</p>
						<p className="mt-1 text-2xs text-storm-subtle">Full access to all features.</p>
						<Link
							href="/contact"
							className="mt-2 inline-flex text-2xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
						>
							Priority Support →
						</Link>
					</div>
				)}
			</div>

			{/* Collapsed bottom icon — shows when collapsed */}
			<div className={`flex items-center justify-center pb-4 transition-all duration-300 ${
				expanded ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-12"
			}`}>
				<Tooltip content={displayTier} side="right">
					<div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
						subscriptionTier === "enterprise"
							? "bg-emerald-500/15 text-emerald-400"
							: "bg-storm-purple/15 text-storm-glow"
					}`}>
						<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
				</Tooltip>
			</div>
		</aside>
	);
}