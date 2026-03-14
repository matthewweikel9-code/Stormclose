"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HotCluster } from "@/types/dashboard";

interface UnassignedHotClustersProps {
	clusters: HotCluster[];
}

export function UnassignedHotClustersWidget({ clusters }: UnassignedHotClustersProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center gap-2">
					<MapPin className="h-4 w-4 text-storm-purple" />
					<CardTitle>Unassigned Hot Clusters</CardTitle>
				</div>
				<CardDescription>High-scoring clusters not yet assigned.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{clusters.map((cluster) => (
					<div key={cluster.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div className="mb-1 flex items-center justify-between">
							<p className="text-sm font-medium text-white">{cluster.label}</p>
							<Badge variant="purple">{cluster.avgOpportunityScore}</Badge>
						</div>
						<p className="text-xs text-storm-muted">{cluster.unworkedHouseCount} unworked • nearest rep {cluster.nearestRepName ?? "N/A"}</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
