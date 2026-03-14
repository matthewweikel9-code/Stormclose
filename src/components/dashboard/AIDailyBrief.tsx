"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AIDailyBrief } from "@/types/dashboard";

interface AIDailyBriefProps {
	brief: AIDailyBrief;
}

export function AIDailyBriefWidget({ brief }: AIDailyBriefProps) {
	return (
		<Card className="bg-storm-z2 border-storm-border">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-storm-purple" />
						<CardTitle>AI Daily Brief</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<Badge variant="purple">AI</Badge>
						<Button size="sm" variant="ghost">Refresh Brief</Button>
					</div>
				</div>
				<CardDescription>{new Date(brief.generatedAt).toLocaleString()}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-storm-muted leading-relaxed">{brief.summary}</p>
				<div className="space-y-2">
					{brief.highlights.map((highlight, index) => (
						<div key={`${highlight.category}-${index}`} className="rounded-xl border border-storm-border bg-storm-z1 p-3 text-xs text-storm-muted">
							<span className="mr-2 uppercase tracking-wider text-storm-subtle">{highlight.category}</span>
							{highlight.text}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
