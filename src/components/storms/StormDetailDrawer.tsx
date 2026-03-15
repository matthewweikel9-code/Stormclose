"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StormZoneDetail } from "@/types/storms";

type StormDetailDrawerProps = {
	zoneId: string | null;
	onClose: () => void;
};

export function StormDetailDrawer({ zoneId, onClose }: StormDetailDrawerProps) {
	const [detail, setDetail] = useState<StormZoneDetail | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!zoneId) {
			setDetail(null);
			return;
		}

		let cancelled = false;
		setLoading(true);

		void fetch(`/api/storm-zones/${zoneId}`)
			.then((response) => response.json())
			.then((payload) => {
				if (cancelled) {
					return;
				}
				setDetail(payload.data ?? null);
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [zoneId]);

	if (!zoneId) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50">
			<button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close storm detail drawer" />
			<aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-storm-border bg-storm-z2 p-5 shadow-2xl">
				<div className="mb-4 flex items-start justify-between gap-2">
					<div>
						<h3 className="text-lg font-semibold text-white">Storm Detail</h3>
						<p className="text-xs text-storm-muted">Zone intelligence and impacted houses</p>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{loading ? <p className="text-sm text-storm-muted">Loading zone detail…</p> : null}
				{!loading && !detail ? <p className="text-sm text-storm-muted">Zone not found.</p> : null}

				{detail ? (
					<div className="grid gap-4">
						<div className="flex items-center justify-end">
							<Button
								size="sm"
								onClick={() => {
									const query = new URLSearchParams({
										action: "generate",
										type: "storm_impact_summary",
										contextType: "storm_zone",
										contextId: detail.zone.id,
									});
									window.location.href = `/dashboard/documents?${query.toString()}`;
								}}
							>
								Generate Document
							</Button>
						</div>
						<div className="rounded-xl border border-storm-border bg-storm-z1 p-4">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-semibold text-white">{detail.zone.name}</h4>
								<Badge variant={detail.zone.opportunityScore >= 80 ? "danger" : "warning"}>{detail.zone.opportunityScore}</Badge>
							</div>
							<p className="mt-2 text-xs text-storm-muted">{detail.zone.houseCount} houses · {detail.zone.unworkedCount} unworked · radius {detail.zone.radiusKm} km</p>
						</div>

						<div>
							<h5 className="mb-2 text-sm font-semibold text-white">Impacted Houses</h5>
							<div className="max-h-[55vh] overflow-y-auto rounded-xl border border-storm-border">
								{detail.houses.map((house) => (
									<div key={house.id} className="border-b border-storm-border px-3 py-2 last:border-b-0">
										<div className="text-sm text-white">{house.address}</div>
										<div className="text-xs text-storm-muted">{house.city}, {house.state} · score {house.opportunityScore}</div>
									</div>
								))}
								{detail.houses.length === 0 ? <p className="p-3 text-xs text-storm-muted">No houses available for this zone.</p> : null}
							</div>
						</div>
					</div>
				) : null}
			</aside>
		</div>
	);
}
