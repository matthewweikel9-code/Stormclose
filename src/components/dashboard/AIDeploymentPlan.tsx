"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AIDeploymentPlan } from "@/types/dashboard";

interface AIDeploymentPlanProps {
	plan: AIDeploymentPlan;
}

export function AIDeploymentPlanWidget({ plan }: AIDeploymentPlanProps) {
	return (
		<Card className="border-storm-border bg-storm-z2">
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-storm-purple" />
						<CardTitle>AI Deployment Plan</CardTitle>
					</div>
					<Badge variant="purple">{plan.status.replaceAll("_", " ")}</Badge>
				</div>
				<CardDescription>{plan.reasoning}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{plan.assignments.map((assignment) => (
					<div key={`${assignment.repId}-${assignment.stormZoneId}`} className="rounded-xl border border-storm-border bg-storm-z1 p-3">
						<p className="text-sm font-medium text-white">{assignment.repName} → {assignment.stormZoneName}</p>
						<p className="text-xs text-storm-muted">{assignment.estimatedHouseCount} houses planned</p>
					</div>
				))}
				<div className="flex gap-2">
					<Button size="sm">Approve</Button>
					<Button size="sm" variant="secondary">Dismiss</Button>
				</div>
			</CardContent>
		</Card>
	);
}
