"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText } from "lucide-react";
import { useUserRole } from "@/hooks/auth/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Mission, MissionStatus, MissionStop } from "@/types/missions";

type MissionsHubProps = {
	metadataRole?: string | null;
};

type MissionDetail = {
	mission: Mission;
	stops: MissionStop[];
	liveRepPosition?: { lat: number; lng: number } | null;
};

const statusFilters: Array<{ label: string; value: "all" | MissionStatus }> = [
	{ label: "All", value: "all" },
	{ label: "Planned", value: "planned" },
	{ label: "Active", value: "active" },
	{ label: "Paused", value: "paused" },
	{ label: "Completed", value: "completed" },
	{ label: "Expired", value: "expired" },
];

function statusBadgeVariant(status: MissionStatus): "purple" | "info" | "warning" | "success" | "danger" {
	if (status === "planned") return "purple";
	if (status === "active") return "info";
	if (status === "paused") return "warning";
	if (status === "completed") return "success";
	return "danger";
}

function missionKpis(missions: Mission[]) {
	return {
		total: missions.length,
		active: missions.filter((mission) => mission.status === "active").length,
		planned: missions.filter((mission) => mission.status === "planned").length,
		completed: missions.filter((mission) => mission.status === "completed").length,
	};
}

function MissionMap({ detail }: { detail: MissionDetail | null }) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
	const [mapReady, setMapReady] = useState(false);

	useEffect(() => {
		if (!detail || !token || !mapRef.current) {
			return;
		}

		let map: any = null;
		let cancelled = false;
		const markers: any[] = [];

		async function run() {
			const mapboxgl = (await import("mapbox-gl")).default;
			mapboxgl.accessToken = token;
			const center = {
				lat: detail.mission.centerLat ?? detail.stops[0]?.lat ?? 32.7767,
				lng: detail.mission.centerLng ?? detail.stops[0]?.lng ?? -96.797,
			};

			map = new mapboxgl.Map({
				container: mapRef.current as HTMLElement,
				style: "mapbox://styles/mapbox/dark-v11",
				center: [center.lng, center.lat],
				zoom: 9,
			});

			map.on("load", () => {
				if (cancelled) return;
				setMapReady(true);

				detail.stops.forEach((stop, index) => {
					const marker = new mapboxgl.Marker({ color: "#6D5CFF" })
						.setLngLat([stop.lng, stop.lat])
						.setPopup(
							new mapboxgl.Popup({ offset: 10 }).setHTML(
								`<div style=\"font-size:12px\"><strong>#${index + 1}</strong> ${stop.address}<br/>${stop.status}</div>`
							)
						)
						.addTo(map);
					markers.push(marker);
				});

				if (detail.liveRepPosition?.lat && detail.liveRepPosition?.lng) {
					const rep = new mapboxgl.Marker({ color: "#10B981" })
						.setLngLat([detail.liveRepPosition.lng, detail.liveRepPosition.lat])
						.setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML("<div style=\"font-size:12px\">Rep Position</div>"))
						.addTo(map);
					markers.push(rep);
				}
			});
		}

		void run();

		return () => {
			cancelled = true;
			setMapReady(false);
			markers.forEach((marker) => marker.remove());
			if (map) map.remove();
		};
	}, [detail, token]);

	if (!detail) {
		return (
			<div className="h-[360px] rounded-xl border border-storm-border bg-storm-z1 p-4 text-sm text-storm-muted">
				Select a mission to view the map.
			</div>
		);
	}

	if (!token) {
		return (
			<div className="h-[360px] rounded-xl border border-storm-border bg-storm-z1 p-4">
				<p className="text-sm text-storm-muted">`NEXT_PUBLIC_MAPBOX_TOKEN` missing. Showing stop list fallback.</p>
				<div className="mt-3 grid gap-2">
					{detail.stops.slice(0, 8).map((stop, index) => (
						<div key={stop.id} className="rounded-lg border border-storm-border bg-storm-z2 px-3 py-2 text-sm text-white">
							<div className="font-semibold">#{index + 1} {stop.address}</div>
							<div className="text-xs text-storm-muted">{stop.status}</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-[360px] overflow-hidden rounded-xl border border-storm-border">
			<div ref={mapRef} className="h-full w-full" />
			{!mapReady ? (
				<div className="absolute inset-0 flex items-center justify-center bg-storm-z1/80 text-sm text-storm-muted">Loading map…</div>
			) : null}
		</div>
	);
}

function ActiveMissionRepView({ mission, onRefresh }: { mission: MissionDetail; onRefresh: () => void }) {
	const currentStop = mission.stops.find((stop) => stop.status === "targeted" || stop.status === "attempted") || mission.stops[0] || null;
	const nextStops = mission.stops.filter((stop) => stop.id !== currentStop?.id).slice(0, 3);
	const [loading, setLoading] = useState(false);

	async function submitOutcome(status: MissionStop["status"]) {
		if (!currentStop) return;
		setLoading(true);
		await fetch(`/api/mission-stops/${currentStop.id}/outcome`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status, outcomeData: { source: "quick_button" } }),
		});
		setLoading(false);
		onRefresh();
	}

	return (
		<div className="grid gap-5 xl:grid-cols-3">
			<Card className="xl:col-span-2">
				<CardHeader>
					<CardTitle>Active Mission</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-xl border border-storm-border bg-storm-z1 p-4">
						<p className="text-xs uppercase tracking-wide text-storm-subtle">Current Stop</p>
						<p className="mt-1 text-base font-semibold text-white">{currentStop?.address ?? "No active stop"}</p>
						<p className="text-xs text-storm-muted">Status: {currentStop?.status ?? "n/a"}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" onClick={() => submitOutcome("no_answer")} disabled={loading || !currentStop}>No Answer</Button>
						<Button size="sm" variant="secondary" onClick={() => submitOutcome("interested")} disabled={loading || !currentStop}>Interested</Button>
						<Button size="sm" variant="ghost" onClick={() => submitOutcome("not_interested")} disabled={loading || !currentStop}>Not Interested</Button>
						<Button size="sm" variant="secondary" onClick={() => submitOutcome("follow_up_needed")} disabled={loading || !currentStop}>Follow Up</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={!currentStop}
							onClick={() => {
								if (!currentStop) return;
								const query = new URLSearchParams({
									module: "mission_copilot",
									missionId: mission.mission.id,
									stopId: currentStop.id,
									houseId: currentStop.houseId ?? currentStop.id,
								});
								window.location.href = `/dashboard/ai-studio?${query.toString()}`;
							}}
						>
							<Bot className="mr-1 h-3.5 w-3.5" />
							AI Assist
						</Button>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Next Stops</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{nextStops.length === 0 ? <p className="text-sm text-storm-muted">No additional stops.</p> : null}
					{nextStops.map((stop) => (
						<div key={stop.id} className="rounded-lg border border-storm-border bg-storm-z1 px-3 py-2">
							<div className="text-sm font-semibold text-white">{stop.address}</div>
							<div className="text-xs text-storm-muted">{stop.status}</div>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

export function MissionsHub({ metadataRole }: MissionsHubProps) {
	const role = useUserRole({ metadataRole });
	const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("all");
	const [missions, setMissions] = useState<Mission[]>([]);
	const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
	const [selectedMission, setSelectedMission] = useState<MissionDetail | null>(null);
	const [loading, setLoading] = useState(false);

	const filters = useMemo(() => ({ status: status === "all" ? undefined : status }), [status]);
	const kpis = useMemo(() => missionKpis(missions), [missions]);

	async function fetchMissions() {
		setLoading(true);
		const qs = new URLSearchParams();
		if (filters.status) qs.set("status", filters.status);
		const response = await fetch(`/api/missions?${qs.toString()}`);
		const payload = await response.json();
		const data: Mission[] = Array.isArray(payload.data) ? payload.data : [];
		setMissions(data);
		if (!selectedMissionId && data.length > 0) {
			setSelectedMissionId(data[0].id);
		}
		setLoading(false);
	}

	async function fetchMissionDetail(missionId: string) {
		const response = await fetch(`/api/missions/${missionId}`);
		const payload = await response.json();
		setSelectedMission(payload.data ?? null);
	}

	useEffect(() => {
		void fetchMissions();
	}, [filters.status]);

	useEffect(() => {
		if (!selectedMissionId) return;
		void fetchMissionDetail(selectedMissionId);
	}, [selectedMissionId]);

	const repMission = useMemo(() => {
		if (role !== "rep") return null;
		if (!missions.length) return null;
		return missions.find((mission) => mission.status === "active") || missions[0] || null;
	}, [role, missions]);

	useEffect(() => {
		if (role !== "rep" || !repMission) return;
		setSelectedMissionId(repMission.id);
	}, [role, repMission]);

	if (role === "rep") {
		return (
			<div className="grid gap-5">
				<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
					<h1 className="text-2xl font-bold text-white">My Mission</h1>
					<p className="text-sm text-storm-muted">Active mission mode with quick outcomes and next-best guidance.</p>
				</header>
				{selectedMission ? (
					<>
						<ActiveMissionRepView mission={selectedMission} onRefresh={() => {
							if (selectedMissionId) {
								void fetchMissionDetail(selectedMissionId);
							}
							void fetchMissions();
						}} />
						<Card>
							<CardHeader>
								<CardTitle>Mission Map</CardTitle>
							</CardHeader>
							<CardContent>
								<MissionMap detail={selectedMission} />
							</CardContent>
						</Card>
					</>
				) : (
					<Card>
						<CardContent className="py-8 text-sm text-storm-muted">No assigned mission yet.</CardContent>
					</Card>
				)}
			</div>
		);
	}

	return (
		<div className="grid gap-5">
			<header className="rounded-2xl border border-storm-border bg-storm-z2 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-white">Missions</h1>
						<p className="text-sm text-storm-muted">Plan, execute, and monitor field missions.</p>
					</div>
					<Button onClick={() => void fetchMissions()} variant="secondary">Refresh</Button>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Badge variant="purple">Total: {kpis.total}</Badge>
					<Badge variant="info">Active: {kpis.active}</Badge>
					<Badge variant="warning">Planned: {kpis.planned}</Badge>
					<Badge variant="success">Completed: {kpis.completed}</Badge>
				</div>
			</header>

			<div className="flex flex-wrap gap-2">
				{statusFilters.map((option) => (
					<Button
						key={option.value}
						variant={status === option.value ? "primary" : "secondary"}
						size="sm"
						onClick={() => setStatus(option.value)}
					>
						{option.label}
					</Button>
				))}
			</div>

			<div className="grid gap-5 xl:grid-cols-3">
				<Card className="xl:col-span-1">
					<CardHeader>
						<CardTitle>Mission List</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{loading ? <p className="text-sm text-storm-muted">Loading missions…</p> : null}
						{missions.length === 0 && !loading ? <p className="text-sm text-storm-muted">No missions found.</p> : null}
						{missions.map((mission) => (
							<button
								key={mission.id}
								onClick={() => setSelectedMissionId(mission.id)}
								className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2 text-left hover:border-storm-purple"
							>
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-semibold text-white">{mission.name}</p>
									<Badge variant={statusBadgeVariant(mission.status)}>{mission.status}</Badge>
								</div>
								<p className="mt-1 text-xs text-storm-muted">{new Date(mission.createdAt).toLocaleString()}</p>
							</button>
						))}
					</CardContent>
				</Card>

				<Card className="xl:col-span-2">
					<CardHeader>
						<CardTitle>Mission Map</CardTitle>
					</CardHeader>
					<CardContent>
						<MissionMap detail={selectedMission} />
					</CardContent>
				</Card>
			</div>

			{selectedMission ? (
				<Card>
					<CardHeader>
						<CardTitle>Mission Detail</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="mb-4 flex flex-wrap items-center gap-2">
							<Badge variant={statusBadgeVariant(selectedMission.mission.status)}>{selectedMission.mission.status}</Badge>
							<Button size="sm" variant="secondary" onClick={async () => {
								await fetch(`/api/missions/${selectedMission.mission.id}`, {
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ status: "active" }),
								});
								await fetchMissionDetail(selectedMission.mission.id);
								await fetchMissions();
							}}>Start</Button>
							<Button size="sm" variant="secondary" onClick={async () => {
								await fetch(`/api/missions/${selectedMission.mission.id}`, {
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ status: "paused" }),
								});
								await fetchMissionDetail(selectedMission.mission.id);
								await fetchMissions();
							}}>Pause</Button>
							<Button size="sm" onClick={async () => {
								await fetch(`/api/missions/${selectedMission.mission.id}`, {
									method: "PATCH",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ status: "completed" }),
								});
								await fetchMissionDetail(selectedMission.mission.id);
								await fetchMissions();
							}}>Complete</Button>
							<Button size="sm" variant="ghost" onClick={async () => {
								await fetch(`/api/missions/${selectedMission.mission.id}/rebalance`, { method: "POST" });
								await fetchMissionDetail(selectedMission.mission.id);
							}}>Rebalance</Button>
							<Button
								size="sm"
								variant="secondary"
								onClick={() => {
									const query = new URLSearchParams({
										action: "generate",
										type: "mission_recap",
										contextType: "mission",
										contextId: selectedMission.mission.id,
									});
									window.location.href = `/dashboard/documents?${query.toString()}`;
								}}
							>
								<FileText className="mr-1 h-3.5 w-3.5" />
								Generate Document
							</Button>
						</div>

						<div className="grid gap-2">
							{selectedMission.stops.map((stop) => (
								<div key={stop.id} className="rounded-lg border border-storm-border bg-storm-z1 px-3 py-2">
									<div className="flex items-center justify-between gap-2">
										<div>
											<div className="text-sm font-semibold text-white">#{stop.sequence} {stop.address}</div>
											<div className="text-xs text-storm-muted">{stop.city ?? ""} {stop.state ?? ""}</div>
										</div>
										<div className="flex items-center gap-2">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													const query = new URLSearchParams({
														module: "mission_copilot",
														missionId: selectedMission.mission.id,
														stopId: stop.id,
														houseId: stop.houseId ?? stop.id,
													});
													window.location.href = `/dashboard/ai-studio?${query.toString()}`;
												}}
											>
												<Bot className="h-3.5 w-3.5" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													const query = new URLSearchParams({
														action: "generate",
														type: "homeowner_follow_up_letter",
														contextType: "house",
														contextId: stop.houseId ?? stop.id,
													});
													window.location.href = `/dashboard/documents?${query.toString()}`;
												}}
											>
												<FileText className="h-3.5 w-3.5" />
											</Button>
											<Badge variant="outline">{stop.status}</Badge>
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
