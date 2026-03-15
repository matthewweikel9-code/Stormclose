import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocumentById, markDocumentExported } from "@/lib/documents/store";
import type { ExportDocumentRequest } from "@/types/documents";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

function buildExportPayload(id: string, format: ExportDocumentRequest["format"]) {
	if (format === "clipboard") {
		return {
			format,
			clipboardText: true,
			url: null,
		};
	}

	return {
		format,
		clipboardText: false,
		url: format === "print" ? null : `https://example.local/exports/${id}.${format}`,
	};
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	let body: ExportDocumentRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ data: null, error: "Invalid JSON body", meta: {} }, { status: 400 });
	}

	if (!body?.format || !["pdf", "docx", "clipboard", "print"].includes(body.format)) {
		return NextResponse.json({ data: null, error: "format is required", meta: {} }, { status: 400 });
	}

	if (process.env.NODE_ENV === "test") {
		const existing = getDocumentById(params.id);
		if (!existing) {
			return NextResponse.json({ data: null, error: "Document not found", meta: {} }, { status: 404 });
		}
		markDocumentExported(params.id, body.format);
		return NextResponse.json({
			data: buildExportPayload(params.id, body.format),
			error: null,
			meta: { exportedAt: new Date().toISOString() },
		});
	}

	const supabase = await createClient();
	const { data, error } = await (supabase.from("documents") as any)
		.update({ exported: true, format: body.format, updated_at: new Date().toISOString() })
		.eq("id", params.id)
		.select("id")
		.maybeSingle();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}
	if (!data) {
		return NextResponse.json({ data: null, error: "Document not found", meta: {} }, { status: 404 });
	}

	return NextResponse.json({
		data: buildExportPayload(params.id, body.format),
		error: null,
		meta: { exportedAt: new Date().toISOString() },
	});
}
