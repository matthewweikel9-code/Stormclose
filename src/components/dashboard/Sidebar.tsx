"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";
import {
	CloudLightning,
	FileText,
	LayoutDashboard,
	Monitor,
	Navigation,
	Settings,
	Sparkles,
	Upload,
	Users,
	type LucideIcon,
} from "lucide-react";
import { getNavItemsForRole } from "@/config/navigation";
import type { UserRole } from "@/lib/auth/roles";

export interface SidebarProps {
	subscriptionTier?: SubscriptionTier;
	daysUntilTrialEnd?: number | null;
	userRole: UserRole;
}

const iconMap: Record<string, LucideIcon> = {
	LayoutDashboard,
	CloudLightning,
	Navigation,
	Users,
	Monitor,
	Sparkles,
	FileText,
	Upload,
	Settings,
};

export function Sidebar({ subscriptionTier = "free", daysUntilTrialEnd, userRole }: SidebarProps) {
	const pathname = usePathname();
	const [expanded, setExpanded] = useState(false);
	const displayTier = TIER_DISPLAY_NAMES[subscriptionTier] || "Free";
	const navItems = getNavItemsForRole(userRole);

	const getTierBadgeVariant = (): "success" | "warning" | "purple" | "default" => {
		switch (subscriptionTier) {
			case "enterprise": return "success";
			case "pro_plus": return "warning";
			case "pro": return "purple";
			default: return "default";
		}
	};

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
					const IconComponent = iconMap[item.icon] || LayoutDashboard;
					const isActive = item.exact
						? pathname === item.href
						: pathname.startsWith(item.href);

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
										: "bg-storm-z1 text-storm-subtle group-hover:bg-storm-z2 group-hover:text-storm-muted"
								}`}
							>
								<IconComponent className="h-5 w-5" strokeWidth={1.75} />
							</span>

							{/* Label — slides in when expanded */}
							<div
								className={`flex-1 min-w-0 flex items-center justify-between transition-all duration-300 ${
									expanded ? "opacity-100 ml-3" : "opacity-0 ml-0 w-0 overflow-hidden"
								}`}
							>
								<span
									className={`text-sm font-medium truncate ${isActive ? "text-white" : ""}`}
								>
									{item.label}
								</span>
								{item.label === "AI Studio" && expanded && <Badge variant="purple" className="ml-2">AI</Badge>}
								{item.badgeEndpoint && item.label !== "AI Studio" && expanded && (
									<span className="ml-2 h-2 w-2 rounded-full bg-storm-subtle/70" />
								)}
							</div>
						</>
					);

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