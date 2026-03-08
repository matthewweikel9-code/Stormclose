"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { hasFeature, TIER_DISPLAY_NAMES, type SubscriptionTier } from "@/lib/subscriptions/tiers";

interface NavItem {
	label: string;
	href: string;
	icon: React.ReactNode;
	feature?: "reports" | "csv_upload" | "email_generation" | "objection_handler" | "photo_analysis";
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
		label: "Storm Command",
		href: "/dashboard/storms",
		icon: (
			<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M13 10V3L4 14h7v7l9-11h-7z"
				/>
			</svg>
		),
	},
	{
		label: "Objection Responses",
		href: "/dashboard/objection",
		feature: "objection_handler",
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
	reportsRemaining?: number | null;
}

export function Sidebar({ subscriptionTier = "free", daysUntilTrialEnd, reportsRemaining }: SidebarProps) {
	const pathname = usePathname();
	const displayTier = TIER_DISPLAY_NAMES[subscriptionTier] || "Free";

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
					<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
						subscriptionTier === "pro_plus" 
							? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400"
							: subscriptionTier === "pro"
							? "bg-[#6D5CFF]/20 text-[#A78BFA]"
							: "bg-slate-700/50 text-slate-400"
					}`}>
						{displayTier}
					</span>
				</div>
				{daysUntilTrialEnd !== null && daysUntilTrialEnd !== undefined && daysUntilTrialEnd > 0 && (
					<p className="mt-1 text-xs text-amber-400">
						Trial ends in {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? "s" : ""}
					</p>
				)}
				{subscriptionTier === "free" && reportsRemaining !== null && reportsRemaining !== undefined && (
					<p className="mt-1 text-xs text-slate-500">
						{reportsRemaining} report{reportsRemaining !== 1 ? "s" : ""} remaining this month
					</p>
				)}
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
				<p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
					Main
				</p>
				{navItems.map((item) => {
					const isActive = pathname === item.href;
					const hasAccess = !item.feature || hasFeature(subscriptionTier, item.feature);
					
					if (!hasAccess) {
						// Disabled state for features user doesn't have access to
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
									<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
										item.badge === "Pro+" 
											? "bg-amber-500/20 text-amber-500"
											: "bg-[#6D5CFF]/20 text-[#6D5CFF]"
									}`}>
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
							{item.label}
							{isActive && (
								<span className="ml-auto h-2 w-2 rounded-full bg-[#6D5CFF]" />
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
				{subscriptionTier !== "pro_plus" ? (
					<div className="rounded-lg bg-gradient-to-r from-[#6D5CFF]/10 to-[#A78BFA]/10 p-4">
						<p className="text-sm font-medium text-white">
							{subscriptionTier === "free" ? "Upgrade to Pro" : "Upgrade to Pro+"}
						</p>
						<p className="mt-1 text-xs text-slate-400">
							{subscriptionTier === "free" 
								? "Unlock unlimited reports, CSV upload & automated emails."
								: "Get AI photo analysis & objection handling."}
						</p>
						<Link
							href="/settings/billing"
							className="mt-3 inline-flex text-xs font-medium text-[#A78BFA] hover:text-[#6D5CFF]"
						>
							View Plans →
						</Link>
					</div>
				) : (
					<div className="rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
						<p className="text-sm font-medium text-white">Pro+ Member</p>
						<p className="mt-1 text-xs text-slate-400">
							You have access to all features.
						</p>
						<Link
							href="/contact"
							className="mt-3 inline-flex text-xs font-medium text-amber-400 hover:text-amber-300"
						>
							Get Support →
						</Link>
					</div>
				)}
			</div>
		</aside>
	);
}
