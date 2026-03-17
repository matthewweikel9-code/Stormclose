"use client";

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
    <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-storm-glow to-storm-purple bg-clip-text text-transparent">
          Storm Ops
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${
              isLive ? "bg-storm-purple text-white" : "bg-zinc-700 text-zinc-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-storm-glow animate-pulse" : "bg-zinc-500"}`} />
            {isLive ? "LIVE" : "Historical"}
          </button>
          {dataSource && dataSource !== "loading" && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
              Source: {dataSource}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={getLocation}
          disabled={geoLoading}
          className={`p-2 rounded-lg transition-colors ${
            hasLocation ? "bg-storm-purple/20 text-storm-glow" : "bg-zinc-800 hover:bg-zinc-700"
          }`}
          title={hasLocation ? "Location active" : "Use my location"}
        >
          {geoLoading ? (
            <div className="w-5 h-5 border-2 border-storm-purple border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setShowRadar(!showRadar)}
          className={`p-2 rounded-lg transition-colors ${
            showRadar ? "bg-storm-purple text-white" : "bg-zinc-800 hover:bg-zinc-700"
          }`}
          title="Toggle radar"
        >
          📡
        </button>

        {!isLive && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:border-storm-purple/50 focus:ring-1 focus:ring-storm-purple/20"
          />
        )}
        <button
          onClick={fetchStormData}
          disabled={loading}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
