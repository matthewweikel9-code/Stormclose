"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { hasFeature, TIER_DISPLAY_NAMES, type SubscriptionTier, type FeatureKey } from "@/lib/subscriptions/tiers";

interface NavItem {
	label: string;
	href: string;
	icon: React.ReactNode;
	feature?: FeatureKey;
	badge?: string;
}

const navItems: NavItem[] = [
	{
		label: "Dashboard",
		href: "/dashboard",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
				/>
			</svg>
		),
	},
	{
		label: "Objection Responses",
		href: "/dashboard/objection",
		feature: "objection_handler",
		badge: "Pro",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
				/>
			</svg>
		),
	},
	{
		label: "Supplement Generator",
		href: "/dashboard/supplements",
		feature: "supplement_generator",
		badge: "Pro+",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
		),
	},
	{
		label: "Negotiation Coach",
		href: "/dashboard/negotiation",
		feature: "negotiation_coach",
		badge: "Pro+",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
				/>
			</svg>
		),
	},
	{
		label: "Carrier Intelligence",
		href: "/dashboard/carriers",
		feature: "carrier_intelligence",
		badge: "Enterprise",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
				/>
			</svg>
		),
	},
	{
		label: "Lead Generator",
		href: "/dashboard/leads",
		feature: "lead_generator",
		badge: "Enterprise",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
				/>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		),
	},
	{
		label: "Route Planner",
		href: "/dashboard/route-planner",
		feature: "lead_generator",
		badge: "Enterprise",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
				/>
			</svg>
		),
	},
	{
		label: "Roof Measurement AI",
		href: "/dashboard/roof-measure",
		feature: "roof_measurement",
		badge: "Enterprise",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
				/>
			</svg>
		),
	},
];

const settingsItems = [
	{
		label: "Settings",
		href: "/settings",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		),
	},
];

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

	const getBadgeStyle = (badge?: string) => {
		switch (badge) {
			case "Enterprise":
				return "bg-emerald-500/20 text-emerald-400";
			case "Pro+":
				return "bg-amber-500/20 text-amber-400";
			case "Pro":
				return "bg-[#6D5CFF]/20 text-[#A78BFA]";
			default:
				return "bg-slate-700/50 text-slate-400";
		}
	};

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
				<p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
					Features
				</p>
				{navItems.map((item) => {
					const isActive = pathname === item.href;
					const hasAccess = !item.feature || hasFeature(subscriptionTier, item.feature);
					
					if (!hasAccess) {
						return (
							<div
								key={item.href}
								className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 cursor-not-allowed"
							>
								<span className="text-slate-600">
									{item.icon}
								</span>
								<span className="flex-1">{item.label}</span>
								{item.badge && (
									<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getBadgeStyle(item.badge)}`}>
										{item.badge}
									</span>
								)}
							</div>
						);
					}
					
					return (
						<Link
							key={item.href}
							href={item.href}
							className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
								isActive
									? "bg-[#6D5CFF]/10 text-[#A78BFA]"
									: "text-slate-400 hover:bg-[#1E293B] hover:text-white"
							}`}
						>
							<span
								className={isActive ? "text-[#A78BFA]" : "text-slate-500"}
							>
								{item.icon}
							</span>
							<span className="flex-1">{item.label}</span>
							{isActive && (
								<span className="h-2 w-2 rounded-full bg-[#6D5CFF]" />
							)}
						</Link>
					);
				})}

				<p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
					Account
				</p>
				{settingsItems.map((item) => {
					const isActive = pathname.startsWith(item.href);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
								isActive
									? "bg-[#6D5CFF]/10 text-[#A78BFA]"
									: "text-slate-400 hover:bg-[#1E293B] hover:text-white"
							}`}
						>
							<span
								className={isActive ? "text-[#A78BFA]" : "text-slate-500"}
							>
								{item.icon}
							</span>
							{item.label}
						</Link>
					);
				})}
			</nav>

			{/* Bottom section */}
			<div className="border-t border-[#1F2937] p-4">
				{subscriptionTier !== "enterprise" ? (
					<div className="rounded-lg bg-gradient-to-r from-[#6D5CFF]/10 to-[#A78BFA]/10 p-4">
						<p className="text-sm font-medium text-white">
							{subscriptionTier === "free" && "Upgrade to Pro"}
							{subscriptionTier === "trial" && "Upgrade to Pro"}
							{subscriptionTier === "pro" && "Upgrade to Pro+"}
							{subscriptionTier === "pro_plus" && "Upgrade to Enterprise"}
						</p>
						<p className="mt-1 text-xs text-slate-400">
							{subscriptionTier === "free" && "Unlock Objection AI responses."}
							{subscriptionTier === "trial" && "Keep your access after trial ends."}
							{subscriptionTier === "pro" && "Get Supplement AI & Negotiation Coach."}
							{subscriptionTier === "pro_plus" && "Full access to Carrier Intel, Storm Command & SMS AI."}
						</p>
						<Link
							href="/settings/billing"
							className="mt-3 inline-flex text-xs font-medium text-[#A78BFA] hover:text-[#6D5CFF]"
						>
							View Plans →
						</Link>
					</div>
				) : (
					<div className="rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
						<p className="text-sm font-medium text-white">Enterprise Member</p>
						<p className="mt-1 text-xs text-slate-400">
							You have access to all features.
						</p>
						<Link
							href="/contact"
							className="mt-3 inline-flex text-xs font-medium text-emerald-400 hover:text-emerald-300"
						>
							Priority Support →
						</Link>
					</div>
				)}
			</div>
		</aside>
	);
}
