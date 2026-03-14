import { describe, expect, it } from "vitest";
import { GET as getWatchlists, POST as postWatchlist } from "@/app/api/watchlists/route";
import { PATCH as patchWatchlist } from "@/app/api/watchlists/[id]/route";

describe("watchlists api", () => {
	it("creates and returns watchlist in mock store", async () => {
		const createRequest = new Request("http://localhost/api/watchlists", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Test Territory",
				boundsWkt: "POLYGON((-96.95 32.86,-96.65 32.86,-96.65 32.98,-96.95 32.98,-96.95 32.86))",
				alertThreshold: 75,
				active: true,
			}),
		}) as any;

		const createResponse = await postWatchlist(createRequest);
		const createPayload = await createResponse.json();

		expect(createPayload).toMatchObject({
			data: {
				id: expect.any(String),
				name: "Test Territory",
				alertThreshold: 75,
				active: true,
			},
			error: null,
		});

		const listResponse = await getWatchlists();
		const listPayload = await listResponse.json();
		expect(Array.isArray(listPayload.data)).toBe(true);
		expect(listPayload.data.some((item: { id: string }) => item.id === createPayload.data.id)).toBe(true);
	});

	it("updates watchlist active state", async () => {
		const createRequest = new Request("http://localhost/api/watchlists", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Patch Me",
				boundsWkt: "POLYGON((-96.95 32.86,-96.65 32.86,-96.65 32.98,-96.95 32.98,-96.95 32.86))",
				alertThreshold: 70,
				active: true,
			}),
		}) as any;
		const createResponse = await postWatchlist(createRequest);
		const createPayload = await createResponse.json();
		const watchlistId = createPayload.data.id as string;

		const patchRequest = new Request(`http://localhost/api/watchlists/${watchlistId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ active: false }),
		}) as any;

		const patchResponse = await patchWatchlist(patchRequest, { params: { id: watchlistId } });
		const patchPayload = await patchResponse.json();

		expect(patchPayload).toMatchObject({
			data: {
				id: watchlistId,
				active: false,
			},
			error: null,
		});
	});
});
