"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StormZone } from "@/types/storms";

type LiveStormMapProps = {
	zones: StormZone[];
	onSelectZone: (zone: StormZone) => void;
};

export function LiveStormMap({ zones, onSelectZone }: LiveStormMapProps) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

	const fallbackCenter = useMemo(() => {
		if (zones.length === 0) {
			return { lat: 32.7767, lng: -96.797 };
		}
		const lat = zones.reduce((sum, zone) => sum + zone.centroidLat, 0) / zones.length;
		const lng = zones.reduce((sum, zone) => sum + zone.centroidLng, 0) / zones.length;
		return { lat, lng };
	}, [zones]);

	useEffect(() => {
		if (!token || !mapRef.current) {
			return;
		}

		let map: any = null;
		let cancelled = false;

		async function mountMap() {
			const mapboxgl = (await import("mapbox-gl")).default;
			mapboxgl.accessToken = token;

			map = new mapboxgl.Map({
				container: mapRef.current as HTMLElement,
				style: "mapbox://styles/mapbox/dark-v11",
				center: [fallbackCenter.lng, fallbackCenter.lat],
				zoom: 8,
			});

			map.on("load", () => {
				if (cancelled) {
					return;
				}
				setMapReady(true);
				for (const zone of zones) {
					const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
						`<div style=\"font-size:12px\"><strong>${zone.name}</strong><br/>Score: ${zone.opportunityScore}<br/>Unworked: ${zone.unworkedCount}</div>`
					);

					const marker = new mapboxgl.Marker({ color: "#6D5CFF" })
						.setLngLat([zone.centroidLng, zone.centroidLat])
						.setPopup(popup)
						.addTo(map);

					marker.getElement().addEventListener("click", () => onSelectZone(zone));
				}
			});
		}

		void mountMap();

		return () => {
			cancelled = true;
			setMapReady(false);
			if (map) {
				map.remove();
			}
		};
	}, [token, zones, onSelectZone, fallbackCenter.lat, fallbackCenter.lng]);

	return (
		<Card className="h-full overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Live Storm Map</CardTitle>
				{token ? <Badge variant="purple">Mapbox</Badge> : <Badge variant="warning">Token Missing</Badge>}
			</CardHeader>
			<CardContent className="pt-0">
				{token ? (
					<div className="relative h-[420px] overflow-hidden rounded-xl border border-storm-border">
						<div ref={mapRef} className="h-full w-full" />
						{!mapReady ? (
							<div className="absolute inset-0 flex items-center justify-center bg-storm-z1/80 text-xs text-storm-muted">
								Loading map…
							</div>
						) : null}
					</div>
				) : (
					<div className="h-[420px] overflow-hidden rounded-xl border border-storm-border bg-storm-z1 p-4">
						<p className="text-sm text-storm-muted">`NEXT_PUBLIC_MAPBOX_TOKEN` is not configured. Using fallback list view.</p>
						<div className="mt-3 grid gap-2">
							{zones.slice(0, 6).map((zone) => (
								<button
									key={zone.id}
									onClick={() => onSelectZone(zone)}
									className="rounded-lg border border-storm-border bg-storm-z2 px-3 py-2 text-left text-sm text-white hover:border-storm-purple"
								>
									<div className="font-semibold">{zone.name}</div>
									<div className="text-xs text-storm-muted">Score {zone.opportunityScore} · {zone.unworkedCount} unworked</div>
								</button>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
