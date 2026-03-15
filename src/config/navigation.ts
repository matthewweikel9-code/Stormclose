import type { UserRole } from "@/lib/auth/roles";

export interface NavItemConfig {
	label: string;
	href: string;
	icon: string;
	requiredRoles: UserRole[];
	badgeEndpoint?: string;
	exact?: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
	{
		label: "Dashboard",
		href: "/dashboard",
		icon: "LayoutDashboard",
		requiredRoles: ["owner", "manager", "rep", "office_admin"],
		exact: true,
	},
	{
		label: "Storms",
		href: "/dashboard/storms",
		icon: "CloudLightning",
		requiredRoles: ["owner", "manager"],
		badgeEndpoint: "/api/dashboard/today",
	},
	{
		label: "Missions",
		href: "/dashboard/missions",
		icon: "Navigation",
		requiredRoles: ["owner", "manager", "rep"],
		badgeEndpoint: "/api/dashboard/today",
	},
	{
		label: "Team",
		href: "/dashboard/team",
		icon: "Users",
		requiredRoles: ["owner", "manager"],
		badgeEndpoint: "/api/team/exceptions",
	},
	{
		label: "Mission Control",
		href: "/dashboard/mission-control",
		icon: "Monitor",
		requiredRoles: ["owner", "manager", "office_admin"],
		badgeEndpoint: "/api/team/live",
	},
	{
		label: "AI Studio",
		href: "/dashboard/ai-studio",
		icon: "Sparkles",
		requiredRoles: ["owner", "manager", "rep", "office_admin"],
	},
	{
		label: "Documents",
		href: "/dashboard/documents",
		icon: "FileText",
		requiredRoles: ["owner", "manager", "office_admin"],
		badgeEndpoint: "/api/documents",
	},
	{
		label: "Exports",
		href: "/dashboard/exports",
		icon: "Upload",
		requiredRoles: ["owner", "manager", "office_admin"],
		badgeEndpoint: "/api/exports",
	},
	{
		label: "Settings",
		href: "/settings",
		icon: "Settings",
		requiredRoles: ["owner", "manager", "rep", "office_admin"],
	},

	// Hidden/deprecated V1 nav surfaces intentionally omitted:
	// Revenue Hub, Storm Ops, AI Assistant, Deal Desk and all V1 drift pages.
];

export function getNavItemsForRole(role: UserRole): NavItemConfig[] {
	return NAV_ITEMS.filter((item) => item.requiredRoles.includes(role));
}
