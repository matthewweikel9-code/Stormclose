import type { UserRole } from "@/lib/auth/roles";

type Rule = {
	prefix: string;
	roles: UserRole[];
};

const ALL_ROLES: UserRole[] = ["owner", "manager", "rep", "office_admin"];

export const PAGE_ROLE_RULES: Rule[] = [
	{ prefix: "/dashboard/missions", roles: ["owner", "manager", "rep"] },
	{ prefix: "/dashboard/team", roles: ["owner", "manager"] },
	{ prefix: "/dashboard/mission-control", roles: ["owner", "manager", "office_admin"] },
	{ prefix: "/dashboard/ai-image-engine", roles: ["owner", "manager", "rep", "office_admin"] },
	{ prefix: "/dashboard/documents", roles: ["owner", "manager", "office_admin"] },
	{ prefix: "/dashboard/exports", roles: ["owner", "manager", "office_admin"] },
	{ prefix: "/dashboard", roles: ALL_ROLES },
	{ prefix: "/settings", roles: ALL_ROLES },
];

export const API_ROLE_RULES: Rule[] = [
	{ prefix: "/api/dashboard", roles: ALL_ROLES },
	{ prefix: "/api/storms", roles: ["owner", "manager"] },
	{ prefix: "/api/storm-zones", roles: ["owner", "manager"] },
	{ prefix: "/api/watchlists", roles: ["owner", "manager"] },
	{ prefix: "/api/houses", roles: ["owner", "manager", "rep", "office_admin"] },
	{ prefix: "/api/missions", roles: ["owner", "manager", "rep"] },
	{ prefix: "/api/mission-stops", roles: ["owner", "manager", "rep"] },
	{ prefix: "/api/presence", roles: ["owner", "manager", "rep"] },
	{ prefix: "/api/team", roles: ["owner", "manager"] },
	{ prefix: "/api/mission-control", roles: ["owner", "manager", "office_admin"] },
	{ prefix: "/api/ai", roles: ["owner", "manager", "rep", "office_admin"] },
	{ prefix: "/api/documents", roles: ["owner", "manager", "rep", "office_admin"] },
	{ prefix: "/api/exports", roles: ["owner", "manager", "office_admin"] },
	// Default protected posture for all non-public API routes.
	{ prefix: "/api", roles: ALL_ROLES },
];

export const PUBLIC_API_PREFIXES = [
	"/api/health",
	"/api/auth/callback",
	"/api/stripe/webhook",
	"/api/cron/",
	"/api/hail-import",
	"/api/storm-alerts/monitor",
	"/api/debug-supabase",
	"/api/demo-request",
	"/api/partner-engine/public/",
	"/api/jobnimbus/webhook",
] as const;

export function getAllowedRoles(pathname: string, rules: Rule[]): UserRole[] | null {
	const matched = rules
		.filter((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`))
		.sort((a, b) => b.prefix.length - a.prefix.length)[0];
	return matched?.roles ?? null;
}

export function isPublicApiPath(pathname: string): boolean {
	return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function hasRoleAccess(pathname: string, role: UserRole, rules: Rule[]): boolean {
	const allowedRoles = getAllowedRoles(pathname, rules);
	if (!allowedRoles) return true;
	return allowedRoles.includes(role);
}
