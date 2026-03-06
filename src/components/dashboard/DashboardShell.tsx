"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

interface DashboardShellProps {
	children: ReactNode;
	user: {
		email?: string | null;
	} | null;
	subscriptionStatus: string;
}

export function DashboardShell({
	children,
	user,
	subscriptionStatus,
}: DashboardShellProps) {
	return (
		<div className="min-h-screen bg-[#0B0F1A]">
			{/* Sidebar */}
			<Sidebar />

			{/* Main content */}
			<div className="pl-64">
				<TopNav user={user} subscriptionStatus={subscriptionStatus} />
				<main className="min-h-[calc(100vh-4rem)] p-6">{children}</main>
			</div>
		</div>
	);
}
