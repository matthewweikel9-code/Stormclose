import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getNavItemsForRole } from "@/config/navigation";

describe("navigation config", () => {
	it("defines the exact V2 primary nav order", () => {
		const labels = NAV_ITEMS.map((item) => item.label);
		expect(labels).toEqual([
			"Dashboard",
			"Storms",
			"Missions",
			"Team",
			"Mission Control",
			"AI Studio",
			"Documents",
			"Exports",
			"Settings",
		]);
	});

	it("filters nav items for owner", () => {
		const ownerItems = getNavItemsForRole("owner").map((item) => item.label);
		expect(ownerItems).toEqual([
			"Dashboard",
			"Storms",
			"Missions",
			"Team",
			"Mission Control",
			"AI Studio",
			"Documents",
			"Exports",
			"Settings",
		]);
	});

	it("filters nav items for manager", () => {
		const managerItems = getNavItemsForRole("manager").map((item) => item.label);
		expect(managerItems).toEqual([
			"Dashboard",
			"Storms",
			"Missions",
			"Team",
			"Mission Control",
			"AI Studio",
			"Documents",
			"Exports",
			"Settings",
		]);
	});

	it("filters nav items for rep", () => {
		const repItems = getNavItemsForRole("rep").map((item) => item.label);
		expect(repItems).toEqual([
			"Dashboard",
			"Missions",
			"AI Studio",
			"Settings",
		]);
	});

	it("filters nav items for office admin", () => {
		const officeAdminItems = getNavItemsForRole("office_admin").map((item) => item.label);
		expect(officeAdminItems).toEqual([
			"Dashboard",
			"Mission Control",
			"AI Studio",
			"Documents",
			"Exports",
			"Settings",
		]);
	});
});
