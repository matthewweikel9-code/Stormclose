import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/lib/documents/store";
import type { DocumentFilters } from "@/types/documents";

function parseBoolean(value: string | null): boolean | undefined {
	if (value === null) return undefined;
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
}

function parseLimit(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return Math.min(200, parsed);
}

async function getUserId() {
	if (process.env.NODE_ENV === "test") return "test-user";
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user?.id ?? null;
}

export async function GET(request: NextRequest) {
	const userId = await getUserId();
	if (!userId) {
		return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const filters: DocumentFilters = {
		type: (searchParams.get("type") as DocumentFilters["type"]) ?? undefined,
		contextType: (searchParams.get("contextType") as DocumentFilters["contextType"]) ?? undefined,
		contextId: searchParams.get("contextId") ?? undefined,
		exported: parseBoolean(searchParams.get("exported")),
		q: searchParams.get("q") ?? undefined,
		limit: parseLimit(searchParams.get("limit")),
	};

	if (process.env.NODE_ENV === "test") {
		const docs = listDocuments(filters);
		return NextResponse.json({
			data: docs,
			error: null,
			meta: { total: docs.length, generatedAt: new Date().toISOString() },
		});
	}

	const supabase = await createClient();
	let query = (supabase.from("documents") as any)
		.select("*")
		.order("created_at", { ascending: false })
		.limit(filters.limit ?? 50);

	if (filters.type) query = query.eq("type", filters.type);
	if (filters.contextType) query = query.eq("context_type", filters.contextType);
	if (filters.contextId) query = query.eq("context_id", filters.contextId);
	if (typeof filters.exported === "boolean") query = query.eq("exported", filters.exported);
	if (filters.q) query = query.or(`title.ilike.%${filters.q}%,content.ilike.%${filters.q}%`);

	const { data, error } = await query;
	if (error) {
		return NextResponse.json({ data: null, error: error.message, meta: {} }, { status: 500 });
	}

	const mapped = (Array.isArray(data) ? data : []).map((row: any) => ({
		id: row.id,
		type: row.type,
		title: row.title,
		contextType: row.context_type,
		contextId: row.context_id,
		content: row.content,
		format: row.format,
		createdBy: row.created_by,
		exported: row.exported,
		status: row.exported ? "exported" : "draft",
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		exportedAt: row.exported ? row.updated_at : null,
		fileUrl: null,
	}));

	return NextResponse.json({
		data: mapped,
		error: null,
		meta: { total: mapped.length, generatedAt: new Date().toISOString() },
	});
}
