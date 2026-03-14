"use client";

import { Bot, Eye, Plus, Send, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HouseToHit } from "@/types/dashboard";

interface HousesToHitTodayProps {
	houses: HouseToHit[];
}

function severityVariant(severity: HouseToHit["stormSeverity"]): "danger" | "warning" | "info" | "default" {
	if (severity === "extreme") return "danger";
	if (severity === "severe") return "warning";
	if (severity === "moderate") return "info";
	return "default";
}

function statusVariant(status: HouseToHit["status"]): "default" | "success" | "warning" | "danger" | "info" {
	if (status === "interested" || status === "sent_to_jobnimbus") return "success";
	if (status === "follow_up_needed") return "warning";
	if (status === "not_interested") return "danger";
	if (status === "attempted" || status === "targeted") return "info";
	return "default";
}

export function HousesToHitTodayWidget({ houses }: HousesToHitTodayProps) {
	return (
		<Card className="bg-storm-z2 border-storm-border">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle>Houses To Hit Today</CardTitle>
						<CardDescription>Primary opportunity queue prioritized by AI.</CardDescription>
					</div>
					<Badge variant="purple">Primary Widget</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[980px] text-left text-xs">
						<thead className="sticky top-0 bg-storm-z2 text-storm-subtle">
							<tr>
								<th className="px-3 py-2 font-medium">Address</th>
								<th className="px-3 py-2 font-medium">Storm Zone</th>
								<th className="px-3 py-2 font-medium">Score</th>
								<th className="px-3 py-2 font-medium">Severity</th>
								<th className="px-3 py-2 font-medium">Assigned Rep</th>
								<th className="px-3 py-2 font-medium">Status</th>
								<th className="px-3 py-2 font-medium">AI Reason</th>
								<th className="px-3 py-2 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{houses.map((house) => (
								<tr key={house.id} className="border-t border-storm-border bg-storm-z1 hover:bg-storm-z2/80">
									<td className="px-3 py-3 text-storm-text">
										<div className="font-medium">{house.address}</div>
										<div className="text-[11px] text-storm-subtle">{house.neighborhood}, {house.city}</div>
									</td>
									<td className="px-3 py-3 text-storm-muted">{house.stormZoneName}</td>
									<td className="px-3 py-3">
										<Badge variant="purple">{house.opportunityScore}</Badge>
									</td>
									<td className="px-3 py-3">
										<Badge variant={severityVariant(house.stormSeverity)}>{house.stormSeverity}</Badge>
									</td>
									<td className="px-3 py-3 text-storm-muted">{house.assignedRepName ?? "Unassigned"}</td>
									<td className="px-3 py-3">
										<Badge variant={statusVariant(house.status)}>{house.status.replaceAll("_", " ")}</Badge>
									</td>
									<td className="max-w-[220px] px-3 py-3 text-storm-muted">{house.aiRankingReason}</td>
									<td className="px-3 py-3">
										<div className="flex flex-wrap items-center gap-1.5">
											<Button size="sm" variant="ghost" title="Assign">
												<UserPlus className="h-3.5 w-3.5" />
											</Button>
											<Button size="sm" variant="ghost" title="Add to Mission">
												<Plus className="h-3.5 w-3.5" />
											</Button>
											<Button size="sm" variant="ghost" title="View Details">
												<Eye className="h-3.5 w-3.5" />
											</Button>
											<Button size="sm" variant="ghost" title="Send to JobNimbus">
												<Send className="h-3.5 w-3.5" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												title="AI Assist"
												onClick={() => {
													const query = new URLSearchParams({
														module: "mission_copilot",
														houseId: house.id,
													});
													window.location.href = `/dashboard/ai-studio?${query.toString()}`;
												}}
											>
												<Bot className="h-3.5 w-3.5" />
											</Button>
											
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
