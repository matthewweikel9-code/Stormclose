"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserRole } from "@/hooks/auth/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveStormMap } from "@/components/storms/LiveStormMap";
import { StormZoneList } from "@/components/storms/StormZoneList";
import { StormDetailDrawer } from "@/components/storms/StormDetailDrawer";
import { WatchlistManager } from "@/components/storms/WatchlistManager";
import type { StormZone } from "@/types/storms";

type StormsIntelligenceProps = {
	metadataRole?: string | null;
};

type ViewMode = "zones" | "watchlists";

export function StormsIntelligence({ metadataRole }: StormsIntelligenceProps) {
	const role = useUserRole({ metadataRole });
	const [zones, setZones] = useState<StormZone[]>([]);
	const [drawerZoneId, setDrawerZoneId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("zones");

	const canAccess = role === "owner" || role === "manager";

	const kpis = useMemo(() => {
		const activeZoneCount = zones.length;
		const totalUnworkedHouseCount = zones.reduce((sum, zone) => sum + zone.unworkedCount, 0);
		const avgZoneScore = zones.length > 0 ? Math.round(zones.reduce((sum, zone) => sum + zone.opportunityScore, 0) / zones.length) : 0;
		return { activeZoneCount, totalUnworkedHouseCount, avgZoneScore };
	}, [zones]);

	useEffect(() => {
		if (!canAccess) {
			return;
		}

		let cancelled = false;
		setLoading(true);

		void fetch("/api/storm-zones?limit=25")
			.then((response) => response.json())
			.then((payload) => {
				if (cancelled) {
					return;
				}
				setZones(Array.isArray(payload.data) ? payload.data : []);
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [canAccess]);

	async function handleGenerateMission(zone: StormZone) {
		await fetch(`/api/storm-zones/${zone.id}/generate-mission`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signature: `zone:${zone.id}` }),
		});
	}

	if (!canAccess) {
		return (
			<div className="rounded-2xl border border-storm-border bg-storm-z2 p-6">
				<h1 className="text-2xl font-bold text-white">Storms</h1>
				<p className="mt-2 text-sm text-storm-muted">This module is available for Owners and Managers.</p>
			</div>
		);
	}

	return (
		<div className="grid gap-5">
			<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-white">Storm Intelligence</h1>
						<p className="text-sm text-storm-muted">Turn raw storm data into ranked, actionable zones.</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant={viewMode === "zones" ? "primary" : "secondary"} onClick={() => setViewMode("zones")}>Zones</Button>
						<Button variant={viewMode === "watchlists" ? "primary" : "secondary"} onClick={() => setViewMode("watchlists")}>Watchlists</Button>
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Badge variant="purple">Active Zones: {kpis.activeZoneCount}</Badge>
					<Badge variant="warning">Unworked Houses: {kpis.totalUnworkedHouseCount}</Badge>
					<Badge variant="info">Avg Zone Score: {kpis.avgZoneScore}</Badge>
				</div>
			</header>

			{viewMode === "watchlists" ? (
				<WatchlistManager />
			) : (
				<div className="grid gap-5 xl:grid-cols-3">
					<div className="xl:col-span-2">
						<LiveStormMap zones={zones} onSelectZone={(zone) => setDrawerZoneId(zone.id)} />
					</div>
					<div className="xl:col-span-1">
						<StormZoneList
							zones={zones}
							onSelectZone={(zone) => setDrawerZoneId(zone.id)}
							onGenerateMission={handleGenerateMission}
						/>
					</div>
				</div>
			)}

			{loading ? <p className="text-sm text-storm-muted">Loading storm zones…</p> : null}
			<StormDetailDrawer zoneId={drawerZoneId} onClose={() => setDrawerZoneId(null)} />
		</div>
	);
}
