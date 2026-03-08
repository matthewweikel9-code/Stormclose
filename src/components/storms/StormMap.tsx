"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { StormEvent } from "@/lib/storms/types";

interface StormMapProps {
	storms: StormEvent[];
	selectedStorm: StormEvent | null;
	onStormSelect: (storm: StormEvent) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
	minor: "#3b82f6",      // blue
	moderate: "#eab308",   // yellow
	severe: "#f97316",     // orange
	extreme: "#ef4444"     // red
};

const EVENT_ICONS: Record<string, string> = {
	hail: "🧊",
	wind: "💨",
	tornado: "🌪️",
	mixed: "⛈️"
};

export function StormMap({ storms, selectedStorm, onStormSelect }: StormMapProps) {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<mapboxgl.Marker[]>([]);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [mapError, setMapError] = useState<string | null>(null);

	// Get Mapbox token from environment
	const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

	useEffect(() => {
		if (!mapContainer.current) return;
		
		if (!mapboxToken) {
			setMapError("NEXT_PUBLIC_MAPBOX_TOKEN not configured");
			return;
		}

		// Initialize map
		mapboxgl.accessToken = mapboxToken;

		try {
			map.current = new mapboxgl.Map({
				container: mapContainer.current,
				style: "mapbox://styles/mapbox/dark-v11",
				center: [-98.5795, 39.8283], // Center of USA
				zoom: 4,
				pitch: 0,
				bearing: 0
			});

			map.current.on("load", () => {
				setMapLoaded(true);
			});

			map.current.on("error", (e) => {
				console.error("Mapbox error:", e);
				setMapError("Failed to load map");
			});

			// Add navigation controls
			map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

			// Cleanup
			return () => {
				markersRef.current.forEach(marker => marker.remove());
				markersRef.current = [];
				map.current?.remove();
			};
		} catch (err) {
			console.error("Map initialization error:", err);
			setMapError("Failed to initialize map");
		}
	}, [mapboxToken]);

	// Update markers when storms change
	useEffect(() => {
		if (!map.current || !mapLoaded) return;

		// Clear existing markers
		markersRef.current.forEach(marker => marker.remove());
		markersRef.current = [];

		// Add new markers
		storms.forEach(storm => {
			if (!storm.latitude || !storm.longitude) return;

			const color = SEVERITY_COLORS[storm.severity || "moderate"];
			const icon = EVENT_ICONS[storm.eventType || "mixed"];
			const isSelected = selectedStorm?.id === storm.id;

			// Create custom marker element
			const el = document.createElement("div");
			el.className = "storm-marker";
			el.innerHTML = `
				<div style="
					background: ${color}${isSelected ? "" : "80"};
					border: 2px solid ${color};
					border-radius: 50%;
					width: ${isSelected ? "40px" : "32px"};
					height: ${isSelected ? "40px" : "32px"};
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: ${isSelected ? "20px" : "16px"};
					cursor: pointer;
					transition: all 0.2s ease;
					box-shadow: ${isSelected ? "0 0 20px " + color : "0 2px 8px rgba(0,0,0,0.3)"};
				">
					${icon}
				</div>
			`;

			el.addEventListener("click", () => {
				onStormSelect(storm);
			});

			el.addEventListener("mouseenter", () => {
				el.style.transform = "scale(1.2)";
			});

			el.addEventListener("mouseleave", () => {
				el.style.transform = "scale(1)";
			});

			const marker = new mapboxgl.Marker({ element: el })
				.setLngLat([storm.longitude, storm.latitude])
				.setPopup(
					new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
						<div style="padding: 8px; background: #1e293b; color: white; border-radius: 8px;">
							<div style="font-weight: bold; margin-bottom: 4px;">
								${icon} ${storm.eventType?.toUpperCase() || "STORM"}
							</div>
							<div style="font-size: 12px; color: #94a3b8;">
								${storm.city || "Unknown"}, ${storm.state || ""}
							</div>
							<div style="font-size: 11px; color: #64748b; margin-top: 4px;">
								${storm.hailSizeInches ? `Hail: ${storm.hailSizeInches}"` : ""}
								${storm.windSpeedMph ? `Wind: ${storm.windSpeedMph} mph` : ""}
							</div>
							<div style="font-size: 10px; color: ${color}; margin-top: 4px; text-transform: uppercase;">
								${storm.severity || "Unknown"} severity
							</div>
						</div>
					`)
				)
				.addTo(map.current!);

			markersRef.current.push(marker);
		});
	}, [storms, selectedStorm, mapLoaded, onStormSelect]);

	// Fly to selected storm
	useEffect(() => {
		if (!map.current || !mapLoaded || !selectedStorm) return;
		if (!selectedStorm.latitude || !selectedStorm.longitude) return;

		map.current.flyTo({
			center: [selectedStorm.longitude, selectedStorm.latitude],
			zoom: 8,
			duration: 1500
		});
	}, [selectedStorm, mapLoaded]);

	// Show placeholder if no token
	if (!mapboxToken || mapError) {
		return (
			<div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 text-center">
				<div className="mb-4 text-6xl">🗺️</div>
				<h3 className="text-lg font-semibold text-white">Interactive Storm Map</h3>
				<p className="mt-2 max-w-sm text-sm text-slate-400">
					{mapError || "Live radar integration coming soon. For now, browse storms by state below."}
				</p>
				<div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2">
					<p className="text-xs text-yellow-400">
						Add <code className="rounded bg-slate-700 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your <code className="rounded bg-slate-700 px-1">.env.local</code> file
					</p>
				</div>
				<a 
					href="https://mapbox.com/account/access-tokens" 
					target="_blank" 
					rel="noopener noreferrer"
					className="mt-3 text-xs text-brand-400 hover:text-brand-300 hover:underline"
				>
					Get a free Mapbox token →
				</a>
			</div>
		);
	}

	return (
		<div className="relative h-[400px] overflow-hidden rounded-xl border border-slate-700">
			<div ref={mapContainer} className="h-full w-full" />
			
			{/* Loading overlay */}
			{!mapLoaded && (
				<div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
					<div className="text-center">
						<div className="mb-2 text-3xl animate-pulse">🌍</div>
						<p className="text-sm text-slate-400">Loading map...</p>
					</div>
				</div>
			)}

			{/* Legend */}
			<div className="absolute bottom-4 left-4 rounded-lg border border-slate-700 bg-slate-900/90 p-3 backdrop-blur">
				<p className="mb-2 text-xs font-semibold text-slate-400">SEVERITY</p>
				<div className="space-y-1">
					{Object.entries(SEVERITY_COLORS).map(([severity, color]) => (
						<div key={severity} className="flex items-center gap-2">
							<div 
								className="h-3 w-3 rounded-full" 
								style={{ backgroundColor: color }}
							/>
							<span className="text-xs capitalize text-slate-300">{severity}</span>
						</div>
					))}
				</div>
			</div>

			{/* Storm count badge */}
			<div className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 backdrop-blur">
				<p className="text-xs text-slate-400">
					<span className="font-bold text-white">{storms.length}</span> storms tracked
				</p>
			</div>
		</div>
	);
}
