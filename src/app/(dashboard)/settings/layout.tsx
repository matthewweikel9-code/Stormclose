"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, User, Building2, Users, Puzzle } from "lucide-react";

const SETTINGS_TABS = [
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/company", label: "Company", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/integrations", label: "Integrations", icon: Puzzle },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-1.5 overflow-x-auto scrollbar-hide">
        <nav className="flex items-center gap-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-storm-purple/15 text-storm-glow shadow-glow-sm"
                    : "text-storm-muted hover:bg-storm-z2/60 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-storm-glow" : ""}`} />
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[7px] h-[2px] rounded-full bg-gradient-to-r from-storm-purple to-storm-glow" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
