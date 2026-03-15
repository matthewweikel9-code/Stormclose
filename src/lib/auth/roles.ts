export type UserRole = "owner" | "manager" | "rep" | "office_admin";

export function normalizeUserRole(role: string | null | undefined): UserRole {
	const normalized = (role ?? "").trim().toLowerCase();

	if (normalized === "owner") return "owner";
	if (normalized === "manager") return "manager";
	if (normalized === "office_admin" || normalized === "office-admin" || normalized === "admin") {
		return "office_admin";
	}
	return "rep";
}
