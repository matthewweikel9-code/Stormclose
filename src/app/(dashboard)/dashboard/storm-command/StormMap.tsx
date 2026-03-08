"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Set access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface WeatherAlert {
	type: string;
	severity: string;
	headline: string;
}

interface Property {
	id: string;
	address: {
		full: string;
		street: string;
	};
	location: {
		lat: number;
		lng: number;
	};
	estimatedClaim: {
		average: number;
	};
}

interface StormMapProps {
	center: { lat: number; lng: number };
	zoom: number;
	onLocationSelect: (lat: number, lng: number) => void;
	properties: Property[];
	alerts: WeatherAlert[];
}

export default function StormMap({ center, zoom, onLocationSelect, properties, alerts }: StormMapProps) {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<mapboxgl.Marker[]>([]);
	const [mapLoaded, setMapLoaded] = useState(false);

	// Initialize map
	useEffect(() => {
		if (!mapContainer.current || map.current) return;

		map.current = new mapboxgl.Map({
			container: mapContainer.current,
			style: "mapbox://styles/mapbox/dark-v11",
			center: [center.lng, center.lat],
			zoom: zoom,
			attributionControl: false
		});

		map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

		map.current.on("load", () => {
			setMapLoaded(true);

			// Add weather radar layer (using Mapbox weather tiles)
			if (map.current) {
				// Add a subtle weather overlay effect
				map.current.addSource("radar", {
					type: "raster",
					tiles: [
						`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=demo`
					],
					tileSize: 256
				});

				// Note: In production, you'd use AccuWeather's radar tiles or another weather provider
			}
		});

		// Click handler for zone selection
		map.current.on("click", (e) => {
			const { lng, lat } = e.lngLat;
			onLocationSelect(lat, lng);

			// Add a temporary marker for selected location
			new mapboxgl.Marker({ color: "#6D5CFF" })
				.setLngLat([lng, lat])
				.addTo(map.current!);
		});

		return () => {
			map.current?.remove();
			map.current = null;
		};
	}, []);

	// Update center and zoom
	useEffect(() => {
		if (!map.current || !mapLoaded) return;

		map.current.flyTo({
			center: [center.lng, center.lat],
			zoom: zoom,
			duration: 1500
		});
	}, [center.lat, center.lng, zoom, mapLoaded]);

	// Update property markers
	useEffect(() => {
		if (!map.current || !mapLoaded) return;

		// Clear existing markers
		markersRef.current.forEach(marker => marker.remove());
		markersRef.current = [];

		// Add new markers for properties
		properties.forEach((property) => {
			if (!property.location?.lat || !property.location?.lng) return;

			const el = document.createElement("div");
			el.className = "property-marker";
			el.style.cssText = `
				width: 12px;
				height: 12px;
				background: #10b981;
				border: 2px solid white;
				border-radius: 50%;
				cursor: pointer;
			`;

			const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
				<div style="padding: 8px; min-width: 150px;">
					<p style="font-weight: 600; margin: 0 0 4px 0;">${property.address.street}</p>
					<p style="color: #10b981; margin: 0;">Est. Claim: $${property.estimatedClaim.average.toLocaleString()}</p>
				</div>
			`);

			const marker = new mapboxgl.Marker(el)
				.setLngLat([property.location.lng, property.location.lat])
				.setPopup(popup)
				.addTo(map.current!);

			markersRef.current.push(marker);
		});

		// Fit bounds to show all properties if there are any
		if (properties.length > 1) {
			const bounds = new mapboxgl.LngLatBounds();
			properties.forEach((p) => {
				if (p.location?.lat && p.location?.lng) {
					bounds.extend([p.location.lng, p.location.lat]);
				}
			});
			map.current.fitBounds(bounds, { padding: 50 });
		}
	}, [properties, mapLoaded]);

	// Show alert indicators
	useEffect(() => {
		if (!map.current || !mapLoaded || alerts.length === 0) return;

		// Add visual indication for alerts
		// In production, you'd overlay actual storm polygons from NWS/NOAA
	}, [alerts, mapLoaded]);

	return (
		<div className="relative">
			<div ref={mapContainer} className="h-[500px] w-full rounded-xl" />
			
			{/* Map Legend */}
			<div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 text-xs">
				<p className="font-semibold text-white mb-2">Legend</p>
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-[#6D5CFF]"></div>
						<span className="text-slate-300">Selected Zone</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-emerald-500"></div>
						<span className="text-slate-300">Property</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-red-500"></div>
						<span className="text-slate-300">Storm Alert</span>
					</div>
				</div>
			</div>

			{/* Instructions Overlay */}
			{properties.length === 0 && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-slate-300">
					Click anywhere on the map to analyze properties in that zone
				</div>
			)}

			{/* Alert Badge */}
			{alerts.length > 0 && (
				<div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
					⚠️ {alerts.length} Active Alert{alerts.length > 1 ? "s" : ""}
				</div>
			)}
		</div>
	);
}
