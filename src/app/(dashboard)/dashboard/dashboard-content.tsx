"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageHeader, StatCard, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";
import { useUserStats } from "@/hooks";
import { Pipeline } from "@/components/dashboard/Pipeline";

interface DashboardContentProps {
	user: {
		email?: string | null;
	};
	subscriptionStatus: string;
	subscriptionTier?: "free" | "pro" | "pro_plus";
	logoutAction: () => Promise<void>;
}

const quickActions = [
	{
		title: "Storm Command",
		description: "Track storms, find leads, and build door-knocking routes.",
		href: "/dashboard/storms",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
		title: "Objection Responses",
		description: "Craft confident responses to homeowner objections.",
		href: "/dashboard/objection",
		icon: (
			<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

export function DashboardContent({
	user,
	subscriptionStatus,
	subscriptionTier = "free",
	logoutAction,
}: DashboardContentProps) {
	const { reports, followups, objections, photos, emails, isLoading } = useUserStats();

	const getTierDisplay = () => {
		switch (subscriptionTier) {
			case "pro_plus":
				return "Pro+";
			case "pro":
				return "Pro";
			default:
				return "Free";
		}
	};

	const getTierDescription = () => {
		switch (subscriptionTier) {
			case "pro_plus":
				return "All features unlocked";
			case "pro":
				return "Active plan";
			default:
				return "Limited features";
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-8">
			{/* Header */}
			<PageHeader
				kicker="Dashboard"
				title={`Welcome back${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
				description="Manage your roofing claims and generate professional reports."
				actions={
					<form action={logoutAction}>
						<Button type="submit" variant="secondary" size="sm">
							Log out
						</Button>
					</form>
				}
			/>

			{/* Stats Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Reports Generated"
					value={isLoading ? "..." : reports.toString()}
					description="total"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Follow-ups"
					value={isLoading ? "..." : followups.toString()}
					description="created"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Subscription"
					value={getTierDisplay()}
					description={getTierDescription()}
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
							/>
						</svg>
					}
				/>
				<StatCard
					title="Emails Generated"
					value={isLoading ? "..." : emails.toString()}
					description="total"
					icon={
						<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					}
				/>
			</div>

			{/* Subscription CTA (if not active) */}
			{subscriptionStatus !== "active" && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="relative overflow-hidden rounded-xl border border-[#6D5CFF]/30 bg-gradient-to-r from-[#6D5CFF]/10 via-[#111827] to-[#A78BFA]/10 p-6"
				>
					<div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[#6D5CFF]/20 blur-[60px]" />
					<div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="text-lg font-semibold text-white">
								Upgrade to StormClose Pro
							</h3>
							<p className="mt-1 text-sm text-slate-400">
								Unlock unlimited reports, email generation, and priority support.
							</p>
						</div>
						<Link href="/subscribe">
							<Button variant="primary" glow>
								Upgrade Now
							</Button>
						</Link>
					</div>
				</motion.div>
			)}

			{/* Sales Pipeline */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
			>
				<Card className="p-6">
					<Pipeline />
				</Card>
			</motion.div>

			{/* Quick Actions */}
			<div>
				<h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
				<div className="grid gap-4 md:grid-cols-2">
					{quickActions.map((action, index) => (
						<motion.div
							key={action.href}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: index * 0.1 }}
						>
							<Link href={action.href}>
								<Card hover className="h-full">
									<div className="mb-4 inline-flex rounded-lg bg-[#6D5CFF]/10 p-3 text-[#A78BFA]">
										{action.icon}
									</div>
									<h3 className="text-lg font-semibold text-white">
										{action.title}
									</h3>
									<p className="mt-2 text-sm text-slate-400">
										{action.description}
									</p>
									<p className="mt-4 text-sm font-medium text-[#A78BFA]">
										Open →
									</p>
								</Card>
							</Link>
						</motion.div>
					))}
				</div>
			</div>

			{/* Recent Activity */}
			<Card>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-white">Recent Activity</h2>
					<button className="text-sm text-[#A78BFA] hover:text-[#6D5CFF]">
						View all
					</button>
				</div>
				<div className="space-y-4">
					{[
						{
							title: "Storm detected",
							description: "Hail storm in Dallas County, TX - 1.5\" hail",
							time: "2 hours ago",
						},
						{
							title: "Route completed",
							description: "North Dallas AM Route - 24 doors knocked",
							time: "Yesterday",
						},
						{
							title: "Lead converted",
							description: "Johnson Property - Inspection scheduled",
							time: "2 days ago",
						},
					].map((activity, index) => (
						<div
							key={index}
							className="flex items-center gap-4 rounded-lg border border-[#1F2937] bg-[#0B0F1A] p-4"
						>
							<div className="h-2 w-2 rounded-full bg-[#6D5CFF]" />
							<div className="flex-1">
								<p className="text-sm font-medium text-white">
									{activity.title}
								</p>
								<p className="text-sm text-slate-500">{activity.description}</p>
							</div>
							<span className="text-xs text-slate-500">{activity.time}</span>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
