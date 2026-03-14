"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StormZone } from "@/types/storms";

type StormZoneListProps = {
	zones: StormZone[];
	onSelectZone: (zone: StormZone) => void;
	onGenerateMission: (zone: StormZone) => void;
};

export function StormZoneList({ zones, onSelectZone, onGenerateMission }: StormZoneListProps) {
	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Storm Opportunity Zones</CardTitle>
				<Badge variant="info">{zones.length} zones</Badge>
			</CardHeader>
			<CardContent className="grid max-h-[420px] gap-3 overflow-y-auto">
				{zones.map((zone) => (
					<div key={zone.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div className="flex items-start justify-between gap-2">
							<button className="text-left" onClick={() => onSelectZone(zone)}>
								<div className="text-sm font-semibold text-white">{zone.name}</div>
								<div className="text-xs text-storm-muted">{zone.houseCount} houses · {zone.unworkedCount} unworked</div>
							</button>
							<Badge variant={zone.opportunityScore >= 80 ? "danger" : zone.opportunityScore >= 60 ? "warning" : "info"}>
								{zone.opportunityScore}
							</Badge>
						</div>
						<div className="mt-3 flex gap-2">
							<Button size="sm" variant="secondary" onClick={() => onSelectZone(zone)}>
								Details
							</Button>
							<Button size="sm" onClick={() => onGenerateMission(zone)}>
								Generate Mission
							</Button>
						</div>
					</div>
				))}
				{zones.length === 0 ? <p className="text-sm text-storm-muted">No active storm zones.</p> : null}
			</CardContent>
		</Card>
	);
}
