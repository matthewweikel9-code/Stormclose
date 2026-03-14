"use client";

import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DataHealth } from "@/types/dashboard";

interface DataHealthProps {
	health: DataHealth;
}

function statusVariant(status: "healthy" | "stale" | "down" | "unknown"): "success" | "warning" | "danger" | "default" {
	if (status === "healthy") return "success";
	if (status === "stale") return "warning";
	if (status === "down") return "danger";
	return "default";
}

export function DataHealthWidget({ health }: DataHealthProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Activity className="h-4 w-4 text-storm-purple" />
						<CardTitle>System Freshness / Data Health</CardTitle>
					</div>
					<Badge variant={health.overallHealth === "healthy" ? "success" : health.overallHealth === "degraded" ? "warning" : "danger"}>
						{health.overallHealth}
					</Badge>
				</div>
				<CardDescription>Integration freshness and sync status.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{health.sources.map((source) => (
					<div key={source.source} className="flex items-center justify-between rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div>
							<p className="text-sm font-medium text-white">{source.label}</p>
							<p className="text-xs text-storm-muted">{source.minutesSinceSync ?? "-"} min ago</p>
						</div>
						<Badge variant={statusVariant(source.status)}>{source.status}</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
