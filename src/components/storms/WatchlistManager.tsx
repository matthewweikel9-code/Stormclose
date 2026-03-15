"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TerritoryWatchlist } from "@/types/storms";

export function WatchlistManager() {
	const [watchlists, setWatchlists] = useState<TerritoryWatchlist[]>([]);
	const [loading, setLoading] = useState(false);
	const [name, setName] = useState("High Priority Territory");
	const [threshold, setThreshold] = useState(70);

	const defaultBounds = useMemo(
		() => "POLYGON((-96.95 32.86,-96.65 32.86,-96.65 32.98,-96.95 32.98,-96.95 32.86))",
		[]
	);

	async function loadWatchlists() {
		setLoading(true);
		const response = await fetch("/api/watchlists");
		const payload = await response.json();
		setWatchlists(Array.isArray(payload.data) ? payload.data : []);
		setLoading(false);
	}

	useEffect(() => {
		void loadWatchlists();
	}, []);

	async function createNewWatchlist() {
		const response = await fetch("/api/watchlists", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, boundsWkt: defaultBounds, alertThreshold: threshold, active: true }),
		});
		if (response.ok) {
			await loadWatchlists();
		}
	}

	async function toggleActive(item: TerritoryWatchlist) {
		const response = await fetch(`/api/watchlists/${item.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ active: !item.active }),
		});
		if (response.ok) {
			await loadWatchlists();
		}
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Territory Watchlists</CardTitle>
				<Badge variant="info">{watchlists.length}</Badge>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2 rounded-xl border border-storm-border bg-storm-z1 p-3">
					<label className="text-xs text-storm-muted">Watchlist Name</label>
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white outline-none focus:border-storm-purple"
					/>
					<label className="text-xs text-storm-muted">Alert Threshold</label>
					<input
						type="number"
						value={threshold}
						onChange={(event) => setThreshold(Number(event.target.value) || 0)}
						className="rounded-lg border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white outline-none focus:border-storm-purple"
					/>
					<Button onClick={createNewWatchlist}>Create Watchlist</Button>
				</div>

				{loading ? <p className="text-sm text-storm-muted">Loading watchlists…</p> : null}

				<div className="grid gap-2">
					{watchlists.map((item) => (
						<div key={item.id} className="flex items-center justify-between rounded-lg border border-storm-border bg-storm-z1 px-3 py-2">
							<div>
								<div className="text-sm font-semibold text-white">{item.name}</div>
								<div className="text-xs text-storm-muted">Threshold {item.alertThreshold}</div>
							</div>
							<Button size="sm" variant={item.active ? "secondary" : "primary"} onClick={() => toggleActive(item)}>
								{item.active ? "Deactivate" : "Activate"}
							</Button>
						</div>
					))}
					{watchlists.length === 0 && !loading ? <p className="text-sm text-storm-muted">No watchlists yet.</p> : null}
				</div>
			</CardContent>
		</Card>
	);
}
