"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RecentQualifiedOpportunity } from "@/types/dashboard";

interface RecentQualifiedOppsProps {
	opportunities: RecentQualifiedOpportunity[];
}

function exportStatusVariant(status: RecentQualifiedOpportunity["exportStatus"]): "default" | "success" | "warning" | "danger" {
	if (status === "exported") return "success";
	if (status === "queued") return "warning";
	if (status === "failed") return "danger";
	return "default";
}

export function RecentQualifiedOppsWidget({ opportunities }: RecentQualifiedOppsProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center gap-2">
					<TrendingUp className="h-4 w-4 text-storm-purple" />
					<CardTitle>Recent Qualified Opportunities</CardTitle>
				</div>
				<CardDescription>Latest qualified homeowners from the field.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{opportunities.map((opportunity) => (
					<div key={opportunity.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div className="mb-1 flex items-center justify-between gap-2">
							<p className="text-sm font-medium text-white">{opportunity.address}</p>
							<Badge variant={exportStatusVariant(opportunity.exportStatus)}>{opportunity.exportStatus.replaceAll("_", " ")}</Badge>
						</div>
						<p className="text-xs text-storm-muted">{opportunity.repName} • score {opportunity.opportunityScore}</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
