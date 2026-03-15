export const USER_ROLES = ["owner", "manager", "rep", "office_admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRole(role: string | null | undefined): UserRole {
	if (!role) {
		return "manager";
	}

	const normalized = role.trim().toLowerCase();
	if (normalized === "owner" || normalized === "manager" || normalized === "rep" || normalized === "office_admin") {
		return normalized;
	}

	return "manager";
}