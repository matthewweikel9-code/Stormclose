"use client";

interface KPIStripProps {
  severeStorms: number;
  propertiesAtRisk: number;
  maxHail: string;
  maxWind: number;
  activeMissions: number;
}

export function KPIStrip({
  severeStorms,
  propertiesAtRisk,
  maxHail,
  maxWind,
  activeMissions,
}: KPIStripProps) {
  const items = [
    { label: "Severe Storms", value: severeStorms.toString(), accent: "text-red-500" },
    { label: "Properties at Risk", value: propertiesAtRisk.toString(), accent: "text-orange-500" },
    { label: "Max Hail", value: maxHail, accent: "text-yellow-500" },
    { label: "Max Wind", value: `${maxWind} mph`, accent: "text-storm-glow" },
    { label: "Active Missions", value: activeMissions.toString(), accent: "text-storm-glow" },
  ];

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700/80 hover:border-storm-purple/30 transition-colors min-w-0"
        >
          <span className={`text-lg font-bold ${item.accent}`}>{item.value}</span>
          <span className="text-xs text-zinc-500 truncate">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
