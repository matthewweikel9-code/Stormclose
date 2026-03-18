"use client";

import { MapPin, Radar, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StormOpsHeaderProps {
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  dataSource: string | null;
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  getLocation: () => void;
  geoLoading: boolean;
  hasLocation: boolean;
  showRadar: boolean;
  setShowRadar: (v: boolean) => void;
  fetchStormData: () => void;
  loading: boolean;
}

export function StormOpsHeader({
  isLive,
  setIsLive,
  dataSource,
  selectedDate,
  setSelectedDate,
  getLocation,
  geoLoading,
  hasLocation,
  showRadar,
  setShowRadar,
  fetchStormData,
  loading,
}: StormOpsHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-storm-border/50 glass shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-gradient-purple tracking-tight">
          Storm Ops
        </h1>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            isLive
              ? "bg-storm-purple/20 text-storm-glow border border-storm-purple/30 shadow-glow-sm"
              : "bg-storm-z2 text-storm-muted border border-storm-border hover:border-storm-purple/30"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLive ? "bg-storm-glow animate-pulse" : "bg-storm-subtle"}`} />
          {isLive ? "LIVE" : "Historical"}
        </button>
        {dataSource && dataSource !== "loading" && (
          <Badge variant="default">{dataSource}</Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={getLocation}
          disabled={geoLoading}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            hasLocation
              ? "bg-storm-purple/20 text-storm-glow border border-storm-purple/30"
              : "bg-storm-z2 text-storm-muted border border-storm-border hover:border-storm-purple/30 hover:text-white"
          }`}
          title={hasLocation ? "Location active" : "Use my location"}
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => setShowRadar(!showRadar)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            showRadar
              ? "bg-storm-purple/20 text-storm-glow border border-storm-purple/30"
              : "bg-storm-z2 text-storm-muted border border-storm-border hover:border-storm-purple/30 hover:text-white"
          }`}
          title="Toggle radar"
        >
          <Radar className="h-4 w-4" />
        </button>

        {!isLive && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="dashboard-input text-xs py-1.5 px-2.5"
          />
        )}

        <button
          onClick={fetchStormData}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-storm-z2 text-storm-muted border border-storm-border hover:border-storm-purple/30 hover:text-white transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
