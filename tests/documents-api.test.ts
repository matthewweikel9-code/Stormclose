import { beforeEach, describe, expect, it } from "vitest";
import { GET as listDocumentsRoute } from "@/app/api/documents/route";
import { POST as generateDocumentRoute } from "@/app/api/documents/generate/route";
import { GET as getDocumentRoute, PATCH as patchDocumentRoute } from "@/app/api/documents/[id]/route";
import { POST as exportDocumentRoute } from "@/app/api/documents/[id]/export/route";
import { resetDocumentsStore } from "@/lib/documents/store";

describe("documents api", () => {
	beforeEach(() => {
		resetDocumentsStore();
	});

	it("POST /api/documents/generate validates shape and creates document", async () => {
		const request = new Request("http://localhost/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "homeowner_follow_up_letter",
				contextType: "house",
				contextId: "house-1",
				format: "pdf",
			}),
		}) as any;

		const response = await generateDocumentRoute(request);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			data: {
				id: expect.any(String),
				type: "homeowner_follow_up_letter",
				contextType: "house",
				contextId: "house-1",
				format: "pdf",
			},
			error: null,
		});
	});

	it("GET /api/documents applies type filters", async () => {
		const createA = new Request("http://localhost/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "homeowner_follow_up_letter",
				contextType: "house",
				contextId: "house-1",
				format: "pdf",
			}),
		}) as any;
		const createB = new Request("http://localhost/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "leave_behind",
				contextType: "house",
				contextId: "house-2",
				format: "clipboard",
			}),
		}) as any;

		await generateDocumentRoute(createA);
		await generateDocumentRoute(createB);

		const listRequest = new Request("http://localhost/api/documents?type=leave_behind") as any;
		const listResponse = await listDocumentsRoute(listRequest);
		const listPayload = await listResponse.json();

		expect(listResponse.status).toBe(200);
		expect(Array.isArray(listPayload.data)).toBe(true);
		expect(listPayload.data).toHaveLength(1);
		expect(listPayload.data[0].type).toBe("leave_behind");
	});

	it("POST /api/documents/[id]/export returns export payload", async () => {
		const createRequest = new Request("http://localhost/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "qualified_opportunity_handoff",
				contextType: "opportunity",
				contextId: "opp-1",
				format: "pdf",
			}),
		}) as any;
		const createResponse = await generateDocumentRoute(createRequest);
		const createPayload = await createResponse.json();
		const id = createPayload.data.id;

		const exportRequest = new Request(`http://localhost/api/documents/${id}/export`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ format: "docx" }),
		}) as any;
		const exportResponse = await exportDocumentRoute(exportRequest, { params: { id } });
		const exportPayload = await exportResponse.json();

		expect(exportResponse.status).toBe(200);
		expect(exportPayload).toMatchObject({
			data: {
				format: "docx",
				url: expect.stringContaining(`/${id}.docx`),
			},
			error: null,
		});
	});

	it("GET and PATCH /api/documents/[id] work for editor flow", async () => {
		const createRequest = new Request("http://localhost/api/documents/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "mission_recap",
				contextType: "mission",
				contextId: "mission-1",
				format: "pdf",
			}),
		}) as any;
		const createResponse = await generateDocumentRoute(createRequest);
		const createPayload = await createResponse.json();
		const id = createPayload.data.id;

		const getRequest = new Request(`http://localhost/api/documents/${id}`) as any;
		const getResponse = await getDocumentRoute(getRequest, { params: { id } });
		const getPayload = await getResponse.json();
		expect(getPayload.data.id).toBe(id);

		const patchRequest = new Request(`http://localhost/api/documents/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Updated Mission Recap" }),
		}) as any;
		const patchResponse = await patchDocumentRoute(patchRequest, { params: { id } });
		const patchPayload = await patchResponse.json();
		expect(patchPayload.data.title).toBe("Updated Mission Recap");
	});
});
