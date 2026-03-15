import { describe, expect, it } from "vitest";

describe("module smoke", () => {
	it("logger module exports correctly", async () => {
		const mod = await import("../src/lib/logger");
		expect(mod.logger).toBeDefined();
		expect(typeof mod.logger.info).toBe("function");
		expect(typeof mod.logger.warn).toBe("function");
		expect(typeof mod.logger.error).toBe("function");
	});

	it("audit module exports correctly", async () => {
		const mod = await import("../src/lib/audit");
		expect(typeof mod.logAuditEvent).toBe("function");
	});

	it("api-response helpers export correctly", async () => {
		const mod = await import("../src/utils/api-response");
		expect(typeof mod.successResponse).toBe("function");
		expect(typeof mod.errorResponse).toBe("function");
	});

	it("access-control module exports correctly", async () => {
		const mod = await import("../src/lib/auth/access-control");
		expect(Array.isArray(mod.PAGE_ROLE_RULES)).toBe(true);
		expect(Array.isArray(mod.API_ROLE_RULES)).toBe(true);
		expect(typeof mod.hasRoleAccess).toBe("function");
		expect(typeof mod.isPublicApiPath).toBe("function");
	});

	it("roles module exports correctly", async () => {
		const mod = await import("../src/lib/auth/roles");
		expect(typeof mod.normalizeUserRole).toBe("function");
		expect(mod.normalizeUserRole("owner")).toBe("owner");
		expect(mod.normalizeUserRole("manager")).toBe("manager");
		expect(mod.normalizeUserRole(null)).toBe("manager");
	});

	it("metrics module exports correctly", async () => {
		const mod = await import("../src/lib/metrics");
		expect(mod.metrics).toBeDefined();
		expect(typeof mod.metrics.increment).toBe("function");
	});

	it("featureFlag module exports correctly", async () => {
		const mod = await import("../src/lib/featureFlag");
		expect(typeof mod.isFeatureEnabled).toBe("function");
	});

	it("dashboard mockData exports correctly", async () => {
		const mod = await import("../src/lib/dashboard/mockData");
		expect(typeof mod.getDashboardTodayMockData).toBe("function");
		const data = mod.getDashboardTodayMockData();
		expect(data.kpi).toBeDefined();
		expect(data.exportQueueSummary).toBeDefined();
	});

	it("exports store module exports correctly", async () => {
		const mod = await import("../src/lib/exports/store");
		expect(typeof mod.getExportById).toBe("function");
		expect(typeof mod.getReadyExports).toBe("function");
		expect(typeof mod.listExports).toBe("function");
	});
});
