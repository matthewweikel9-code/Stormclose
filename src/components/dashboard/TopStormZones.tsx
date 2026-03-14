"use client";

import { CloudLightning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StormZoneSummary } from "@/types/dashboard";

interface TopStormZonesProps {
	zones: StormZoneSummary[];
}

export function TopStormZonesWidget({ zones }: TopStormZonesProps) {
	return (
		<Card className="bg-storm-z2 border-storm-border">
			<CardHeader>
				<div className="flex items-center gap-2">
					<CloudLightning className="h-4 w-4 text-storm-purple" />
					<CardTitle>Top Storm Zones</CardTitle>
				</div>
				<CardDescription>Highest-priority zones based on active storm impact.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{zones.map((zone) => (
					<div key={zone.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div className="mb-2 flex items-center justify-between gap-2">
							<p className="text-sm font-medium text-white">{zone.name}</p>
							<Badge variant="purple">{zone.score}</Badge>
						</div>
						<p className="text-xs text-storm-muted">
							{zone.houseCount} houses • {zone.unworkedHouseCount} unworked • {zone.activeMissionCount} active missions
						</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
