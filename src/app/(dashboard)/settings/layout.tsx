"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_TABS = [
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/company", label: "Company" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/integrations", label: "Integrations" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Settings nav tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-storm-border pb-4">
        {SETTINGS_TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-storm-purple/15 text-storm-glow border border-storm-purple/30"
                  : "text-storm-muted hover:text-white hover:bg-storm-z2 border border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
