"use client";

import { Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExportQueueSummary } from "@/types/dashboard";

interface ExportQueueSummaryProps {
	summary: ExportQueueSummary;
}

function rowVariant(status: "success" | "failed" | "pending" | "retrying"): "success" | "danger" | "warning" | "info" {
	if (status === "success") return "success";
	if (status === "failed") return "danger";
	if (status === "retrying") return "info";
	return "warning";
}

export function ExportQueueSummaryWidget({ summary }: ExportQueueSummaryProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Upload className="h-4 w-4 text-storm-purple" />
						<CardTitle>Export Queue Summary</CardTitle>
					</div>
					<Button size="sm">Export All Ready</Button>
				</div>
				<CardDescription>{summary.successRatePercent}% success today</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-2 gap-2 text-xs">
					<div className="rounded-lg border border-storm-border bg-storm-z1 p-2 text-storm-muted">Ready: {summary.readyCount}</div>
					<div className="rounded-lg border border-storm-border bg-storm-z1 p-2 text-storm-muted">Failed: {summary.failedCount}</div>
				</div>
				{summary.recentExports.map((row) => (
					<div key={row.id} className="flex items-center justify-between rounded-xl border border-storm-border bg-storm-z1 p-3">
						<p className="text-xs text-storm-muted">{row.address}</p>
						<Badge variant={rowVariant(row.status)}>{row.status}</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
