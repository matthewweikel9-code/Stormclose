"use client";

import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LiveTeamSnapshot } from "@/types/dashboard";

interface LiveTeamSnapshotProps {
	snapshot: LiveTeamSnapshot;
}

function statusVariant(status: "active" | "idle" | "offline" | "paused"): "success" | "warning" | "danger" | "info" {
	if (status === "active") return "success";
	if (status === "idle") return "warning";
	if (status === "paused") return "info";
	return "danger";
}

export function LiveTeamSnapshotWidget({ snapshot }: LiveTeamSnapshotProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4 text-storm-purple" />
						<CardTitle>Live Team Snapshot</CardTitle>
					</div>
					<Badge variant="info">{snapshot.repsInField} in field</Badge>
				</div>
				<CardDescription>{snapshot.totalReps} reps total • {snapshot.repsUndeployed} undeployed</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{snapshot.reps.map((rep) => (
					<div key={rep.id} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<div className="mb-1 flex items-center justify-between gap-2">
							<p className="text-sm font-medium text-white">{rep.name}</p>
							<Badge variant={statusVariant(rep.fieldStatus)}>{rep.fieldStatus}</Badge>
						</div>
						<p className="text-xs text-storm-muted">{rep.activeMissionName ?? "No active mission"}</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
