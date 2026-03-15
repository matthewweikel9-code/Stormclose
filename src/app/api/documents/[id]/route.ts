import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocumentById, updateDocument } from "@/lib/documents/store";
import type { UpdateDocumentRequest } from "@/types/documents";

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	if (process.env.NODE_ENV === "test") {
		const doc = getDocumentById(params.id);
		if (!doc) {
			return NextResponse.json({ data: null, error: "Document not found", meta: {} }, { status: 404 });
		}
		return NextResponse.json({ data: doc, error: null, meta: {} });
	}

	const supabase = await createClient();
	const { data, error } = await (supabase.from("documents") as any)
		.select("*")
		.eq("id", params.id)
		.maybeSingle();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}
	if (!data) {
		return NextResponse.json({ data: null, error: "Document not found", meta: {} }, { status: 404 });
	}

	return NextResponse.json({
		data: {
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
		},
		error: null,
		meta: {},
	});
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	let body: UpdateDocumentRequest;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ data: null, error: "Invalid JSON body", meta: {} }, { status: 400 });
	}

	if (process.env.NODE_ENV === "test") {
		const updated = updateDocument(params.id, body);
		if (!updated) {
			return NextResponse.json({ data: null, error: "Document not found or not editable", meta: {} }, { status: 404 });
		}
		return NextResponse.json({ data: updated, error: null, meta: {} });
	}

	const patch: Record<string, unknown> = {};
	if (typeof body.title === "string") patch.title = body.title;
	if (typeof body.content === "string") patch.content = body.content;

	if (Object.keys(patch).length === 0) {
		return NextResponse.json({ data: null, error: "No editable fields provided", meta: {} }, { status: 400 });
	}

	patch.updated_at = new Date().toISOString();

	const supabase = await createClient();
	const { data, error } = await (supabase.from("documents") as any)
		.update(patch)
		.eq("id", params.id)
		.select("*")
		.maybeSingle();

	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}
	if (!data) {
		return NextResponse.json({ data: null, error: "Document not found", meta: {} }, { status: 404 });
	}

	return NextResponse.json({
		data: {
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
		},
		error: null,
		meta: {},
	});
}
