import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => ({
		auth: {
			getUser: mockGetUser,
		},
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: mockRedirect,
}));

describe("page smoke", () => {
	beforeEach(() => {
		mockRedirect.mockReset();
		mockGetUser.mockReset();
		mockGetUser.mockResolvedValue({
			data: {
				user: {
					id: "test-user",
					email: "test@example.com",
					user_metadata: { role: "manager" },
				},
			},
		});
	});

	it("dashboard loads", async () => {
		const module = await import("@/app/(dashboard)/dashboard/page");
		expect(typeof module.default).toBe("function");
	});

	it("missions loads", async () => {
		const module = await import("@/app/(dashboard)/dashboard/missions/page");
		expect(typeof module.default).toBe("function");
	});

	it("exports loads", async () => {
		const module = await import("@/app/(dashboard)/dashboard/exports/page");
		expect(typeof module.default).toBe("function");
	});

	it("ai studio loads", async () => {
		const module = await import("@/app/(dashboard)/dashboard/ai-studio/page");
		expect(typeof module.default).toBe("function");
	});
});
