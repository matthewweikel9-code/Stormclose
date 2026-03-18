"use client";

import { CloudLightning, Home, Snowflake, Wind, Navigation } from "lucide-react";

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
    { label: "Severe Storms", value: severeStorms.toString(), accent: "text-red-400", iconBg: "bg-red-500/15", icon: CloudLightning, iconColor: "text-red-400" },
    { label: "Properties at Risk", value: propertiesAtRisk.toString(), accent: "text-orange-400", iconBg: "bg-orange-500/15", icon: Home, iconColor: "text-orange-400" },
    { label: "Max Hail", value: maxHail, accent: "text-amber-400", iconBg: "bg-amber-500/15", icon: Snowflake, iconColor: "text-amber-400" },
    { label: "Max Wind", value: `${maxWind} mph`, accent: "text-storm-glow", iconBg: "bg-storm-purple/15", icon: Wind, iconColor: "text-storm-glow" },
    { label: "Active Missions", value: activeMissions.toString(), accent: "text-emerald-400", iconBg: "bg-emerald-500/15", icon: Navigation, iconColor: "text-emerald-400" },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-storm-border/50 bg-storm-z0/50 shrink-0 overflow-x-auto scrollbar-hide">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-xl border border-storm-border/50 bg-storm-z1/50 px-3 py-1.5 hover:border-storm-purple/30 transition-colors min-w-0"
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${item.iconBg} flex-shrink-0`}>
              <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
            </div>
            <div className="min-w-0">
              <span className={`text-sm font-bold tabular-nums ${item.accent}`}>{item.value}</span>
              <span className="text-2xs text-storm-subtle ml-1.5 hidden sm:inline">{item.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
