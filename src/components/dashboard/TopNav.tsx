"use client";

import Link from "next/link";

interface TopNavProps {
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
}

export function TopNav({ user, subscriptionStatus }: TopNavProps) {
	return (
		<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#1F2937] bg-[#0B0F1A]/80 px-6 backdrop-blur-xl">
			{/* Left side - Breadcrumb or search */}
			<div className="flex items-center gap-4">
				<div className="hidden items-center gap-2 rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-2 sm:flex">
					<svg
						className="h-4 w-4 text-slate-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search..."
						className="w-48 bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none"
					/>
					<kbd className="hidden rounded border border-[#1F2937] bg-[#0B0F1A] px-1.5 py-0.5 text-xs text-slate-500 lg:inline">
						⌘K
					</kbd>
				</div>
			</div>

			{/* Right side - User info */}
			<div className="flex items-center gap-4">
				{/* Subscription badge */}
				<span
					className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
						subscriptionStatus === "active"
							? "bg-emerald-500/10 text-emerald-400"
							: "bg-amber-500/10 text-amber-400"
					}`}
				>
					{subscriptionStatus === "active" ? "Pro" : "Free"}
				</span>

				{/* Upgrade button (if not active) */}
				{subscriptionStatus !== "active" && (
					<Link
						href="/subscribe"
						className="hidden rounded-lg bg-[#6D5CFF] px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-[#5B4AE8] sm:inline-flex"
					>
						Upgrade
					</Link>
				)}

				{/* Notifications */}
				<button className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-[#1E293B] hover:text-white">
					<svg
						className="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#6D5CFF]" />
				</button>

				{/* User avatar */}
				<div className="flex items-center gap-3">
					<div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6D5CFF] to-[#A78BFA]" />
					<div className="hidden lg:block">
						<p className="text-sm font-medium text-white">
							{user?.email?.split("@")[0] || "User"}
						</p>
						<p className="text-xs text-slate-500">{user?.email || ""}</p>
					</div>
				</div>
			</div>
		</header>
	);
}
