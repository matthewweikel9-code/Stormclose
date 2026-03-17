"use client";

import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Optional accent for header (e.g. alert count) */
  badge?: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = true,
  children,
  className = "",
  badge,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-zinc-800 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-storm-glow text-sm">{isOpen ? "▼" : "▶"}</span>
          <h3 className="font-semibold text-sm truncate">{title}</h3>
          {badge}
        </div>
        {subtitle && (
          <span className="text-xs text-zinc-500 truncate max-w-[120px]">{subtitle}</span>
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
