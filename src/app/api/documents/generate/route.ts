import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFromPrompt, estimateUsageCostUsd } from "@/lib/ai";
import {
	buildDocumentDraftPrompt,
	parseDocumentDraftOutput,
	DOCUMENT_TYPE_CONFIGS,
} from "@/lib/ai/modules/documentDraft";
import { buildContext } from "@/lib/ai/buildContext";
import { createDocument } from "@/lib/documents/store";
import type { DocumentFormat, GenerateDocumentRequest } from "@/types/documents";

const VALID_CONTEXT_TYPES = new Set([
	"storm_zone",
	"house",
	"mission",
	"opportunity",
	"team",
	"company",
]);

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

function makeFallbackDraft(input: GenerateDocumentRequest) {
	const config = DOCUMENT_TYPE_CONFIGS[input.type];
	const title = input.title || config.defaultTitle;
	const content = [
		`# ${title}`,
		"",
		`Generated for ${input.contextType} ${input.contextId}.`,
		"",
		"- This is a workflow-connected document draft.",
		"- Update the content before final export.",
	].join("\n");
	return {
		title,
		content,
		wordCount: content.split(/\s+/).filter(Boolean).length,
		generatedAt: new Date().toISOString(),
		model: "fallback-template",
		tokenCount: 0,
	};
}

export async function POST(request: NextRequest) {
	const start = Date.now();
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	let body: GenerateDocumentRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ data: null, error: "Invalid JSON body", meta: {} }, { status: 400 });
	}

	if (!body?.type || !DOCUMENT_TYPE_CONFIGS[body.type]) {
		return NextResponse.json({ data: null, error: "type is required", meta: {} }, { status: 400 });
	}
	if (!body.contextType || !VALID_CONTEXT_TYPES.has(body.contextType)) {
		return NextResponse.json({ data: null, error: "contextType is required", meta: {} }, { status: 400 });
	}
	if (!body.contextId) {
		return NextResponse.json({ data: null, error: "contextId is required", meta: {} }, { status: 400 });
	}

	const format: DocumentFormat = body.format ?? DOCUMENT_TYPE_CONFIGS[body.type].defaultFormat;

	let draft = makeFallbackDraft(body);
	let aiMeta: Record<string, unknown> = {
		model: draft.model,
		tokenCount: draft.tokenCount,
		estimatedCostUsd: 0,
	};

	if (process.env.NODE_ENV !== "test") {
		try {
			const ctx = await buildContext({ userId, outputFormat: "markdown" });
			const { system, user } = buildDocumentDraftPrompt(ctx, {
				documentType: body.type,
				format,
				contextType: body.contextType,
				contextId: body.contextId,
				overrides: body.overrides,
			});
			const result = await generateFromPrompt(system, user);
			draft = parseDocumentDraftOutput(
				result.content,
				{
					documentType: body.type,
					format,
					contextType: body.contextType,
					contextId: body.contextId,
					overrides: body.overrides,
				},
				result.model,
				result.usage?.totalTokens ?? 0,
			);
			aiMeta = {
				model: result.model,
				tokenCount: result.usage?.totalTokens ?? 0,
				estimatedCostUsd: estimateUsageCostUsd(result),
			};
		} catch {
			// Keep fallback draft in case AI key/config isn't available.
		}
	}

	if (process.env.NODE_ENV === "test") {
		const doc = createDocument({
			type: body.type,
			title: body.title || draft.title,
			contextType: body.contextType,
			contextId: body.contextId,
			content: draft.content,
			format,
			createdBy: userId,
		});
		return NextResponse.json({
			data: doc,
			error: null,
			meta: {
				...aiMeta,
				generatedAt: new Date().toISOString(),
				latencyMs: Date.now() - start,
			},
		});
	}

	const supabase = await createClient();
	const insertPayload = {
		type: body.type,
		title: body.title || draft.title,
		context_type: body.contextType,
		context_id: body.contextId,
		content: draft.content,
		format,
		created_by: userId,
		exported: false,
	};

	const { data, error } = await (supabase.from("documents") as any)
		.insert(insertPayload)
		.select("*")
		.single();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	const mapped = {
		id: data.id,
		type: data.type,
		title: data.title,
		contextType: data.context_type,
		contextId: data.context_id,
		content: data.content,
		format: data.format,
		createdBy: data.created_by,
		exported: data.exported,
		status: data.exported ? "exported" : "draft",
		createdAt: data.created_at,
		updatedAt: data.updated_at,
		exportedAt: data.exported ? data.updated_at : null,
		fileUrl: null,
	};

	return NextResponse.json({
		data: mapped,
		error: null,
		meta: {
			...aiMeta,
			generatedAt: new Date().toISOString(),
			latencyMs: Date.now() - start,
		},
	});
}
