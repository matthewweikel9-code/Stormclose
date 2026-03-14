import { describe, expect, it } from "vitest";
import { normalizeUserRole } from "@/lib/auth/roles";
import { resolveUserRole } from "@/hooks/auth/useUserRole";

describe("useUserRole helpers", () => {
	it("normalizes supported roles", () => {
		expect(normalizeUserRole("owner")).toBe("owner");
		expect(normalizeUserRole("manager")).toBe("manager");
		expect(normalizeUserRole("rep")).toBe("rep");
		expect(normalizeUserRole("office_admin")).toBe("office_admin");
	});

	it("falls back to manager for unknown roles", () => {
		expect(normalizeUserRole(undefined)).toBe("manager");
		expect(normalizeUserRole(null)).toBe("manager");
		expect(normalizeUserRole("some_future_role")).toBe("manager");
	});

	it("prefers db role over metadata and fallback role", () => {
		expect(
			resolveUserRole({
				dbRole: "rep",
				metadataRole: "manager",
				fallbackRole: "owner",
			})
		).toBe("rep");
	});

	it("uses metadata role when db role is absent", () => {
		expect(
			resolveUserRole({
				metadataRole: "office_admin",
				fallbackRole: "manager",
			})
		).toBe("office_admin");
	});

	it("uses fallback role as final source", () => {
		expect(resolveUserRole({ fallbackRole: "owner" })).toBe("owner");
	});
});
