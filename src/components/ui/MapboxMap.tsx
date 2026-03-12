"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: "storm" | "hail" | "tornado" | "property" | "location" | "wind" | "severe_thunderstorm";
  severity?: "minor" | "moderate" | "severe" | "extreme";
  popup?: string;
  color?: string;
  size?: number;
}

export interface StormPath {
  id: string;
  coordinates: [number, number][];
  color: string;
  width?: number;
}

export interface MapCircle {
  id: string;
  center: [number, number];
  radiusMiles: number;
  color: string;
  opacity?: number;
}

interface MapboxMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  paths?: StormPath[];
  circles?: MapCircle[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showUserLocation?: boolean;
  className?: string;
  showRadar?: boolean;
  darkMode?: boolean;
}

export default function MapboxMap({
  center = { lat: 39.8283, lng: -98.5795 },
  zoom = 5,
  markers = [],
  paths = [],
  circles = [],
  onMarkerClick,
  onMapClick,
  showUserLocation = true,
  className = "",
  showRadar = false,
  darkMode = true,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const circleIdsRef = useRef<string[]>([]);
  const pathIdsRef = useRef<string[]>([]);
  const onMapClickRef = useRef(onMapClick);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Keep the callback ref up-to-date
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: darkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: zoom,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    
    if (showUserLocation) {
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        "top-right"
      );
    }

    map.current.on("load", () => {
      setMapLoaded(true);
      
      // Add radar layer if enabled
      if (showRadar && map.current) {
        map.current.addSource("radar", {
          type: "raster",
          tiles: [
            `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_=${Date.now()}`
          ],
          tileSize: 256,
        });
        
        map.current.addLayer({
          id: "radar-layer",
          type: "raster",
          source: "radar",
          paint: { "raster-opacity": 0.7 },
        });
      }
    });

    map.current.on("click", (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.lngLat.lat, e.lngLat.lng);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update center
  useEffect(() => {
    if (map.current && mapLoaded) {
      map.current.flyTo({ center: [center.lng, center.lat], zoom });
    }
  }, [center.lat, center.lng, zoom, mapLoaded]);

  // Update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add new markers
    markers.forEach((marker) => {
      const el = document.createElement("div");
      el.className = "storm-marker";
      
      // Style based on type and severity
      const color = marker.color || getMarkerColor(marker.type, marker.severity);
      const size = marker.size || getMarkerSize(marker.type, marker.severity);
      
      el.innerHTML = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.5}px;
          animation: ${marker.severity === "extreme" || marker.severity === "severe" ? "pulse 1.5s infinite" : "none"};
        ">
          ${getMarkerIcon(marker.type)}
        </div>
      `;

      const mapboxMarker = new mapboxgl.Marker({ element: el })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map.current!);

      if (marker.popup) {
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
          .setHTML(`<div style="color: #333; padding: 8px; font-size: 14px;">${marker.popup}</div>`);
        mapboxMarker.setPopup(popup);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onMarkerClick) onMarkerClick(marker);
      });

      markersRef.current.push(mapboxMarker);
    });
  }, [markers, mapLoaded, onMarkerClick]);

  // Update paths (storm tracks)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove all previous path layers/sources
    pathIdsRef.current.forEach((prevId) => {
      if (map.current?.getLayer(`path-${prevId}`)) {
        map.current.removeLayer(`path-${prevId}`);
      }
      if (map.current?.getSource(`path-${prevId}`)) {
        map.current.removeSource(`path-${prevId}`);
      }
    });

    // Track current path IDs
    pathIdsRef.current = paths.map(p => p.id);

    // Add new paths
    paths.forEach((path) => {
      if (path.coordinates.length < 2) return;

      map.current!.addSource(`path-${path.id}`, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: path.coordinates,
          },
        },
      });

      map.current!.addLayer({
        id: `path-${path.id}`,
        type: "line",
        source: `path-${path.id}`,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": path.color,
          "line-width": path.width || 4,
          "line-opacity": 0.8,
        },
      });
    });
  }, [paths, mapLoaded]);

  // Update circles (impact zones)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove all previous circle layers/sources
    circleIdsRef.current.forEach((prevId) => {
      const sourceId = `circle-${prevId}`;
      const layerId = `circle-layer-${prevId}`;
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Track current circle IDs
    circleIdsRef.current = circles.map(c => c.id);

    circles.forEach((circle) => {
      const sourceId = `circle-${circle.id}`;
      const layerId = `circle-layer-${circle.id}`;

      // Create circle polygon
      const radiusKm = circle.radiusMiles * 1.60934;
      const points = 64;
      const coords: [number, number][] = [];
      
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 360;
        const lat = circle.center[1] + (radiusKm / 111.32) * Math.cos((angle * Math.PI) / 180);
        const lng = circle.center[0] + (radiusKm / (111.32 * Math.cos((circle.center[1] * Math.PI) / 180))) * Math.sin((angle * Math.PI) / 180);
        coords.push([lng, lat]);
      }

      map.current!.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
        },
      });

      map.current!.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": circle.color,
          "fill-opacity": circle.opacity || 0.3,
        },
      });
    });
  }, [circles, mapLoaded]);

  return (
    <>
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
      <div ref={mapContainer} className={`w-full h-full ${className}`} />
    </>
  );
}

function getMarkerColor(type: string, severity?: string): string {
  if (severity === "extreme") return "#dc2626";
  if (severity === "severe") return "#f97316";
  if (severity === "moderate") return "#eab308";
  
  switch (type) {
    case "tornado": return "#dc2626";
    case "hail": return "#3b82f6";
    case "wind": return "#8b5cf6";
    case "property": return "#22c55e";
    case "location": return "#06b6d4";
    default: return "#6b7280";
  }
}

function getMarkerSize(type: string, severity?: string): number {
  if (severity === "extreme") return 40;
  if (severity === "severe") return 35;
  if (severity === "moderate") return 30;
  if (type === "property") return 20;
  return 25;
}

function getMarkerIcon(type: string): string {
  switch (type) {
    case "tornado": return "🌪️";
    case "hail": return "🧊";
    case "wind": return "💨";
    case "property": return "🏠";
    case "location": return "📍";
    case "severe_thunderstorm": return "⛈️";
    default: return "⛈️";
  }
}
