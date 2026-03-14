import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExportById, toPreview } from "@/lib/exports/store";

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
		const record = getExportById(params.id);
		if (!record) {
			return NextResponse.json({ data: null, error: "Export not found", meta: {} }, { status: 404 });
		}
		return NextResponse.json({ data: toPreview(record), error: null, meta: { timestamp: new Date().toISOString() } });
	}

	const supabase = await createClient();
	const { data: row, error } = await (supabase.from("opportunity_exports") as any)
		.select("*")
		.eq("id", params.id)
		.single();

	if (error || !row) {
		return NextResponse.json({ data: null, error: "Export not found", meta: {} }, { status: 404 });
	}

	const warnings: string[] = [];
	if (!row.payload?.contact?.mobile_phone && !row.payload?.contact?.email) {
		warnings.push("No contact phone or email captured.");
	}

	return NextResponse.json({
		data: {
			exportId: row.id,
			payload: row.payload,
			handoffSummary: row.payload?.handoffSummary ?? null,
			validationWarnings: warnings,
		},
		error: null,
		meta: { timestamp: new Date().toISOString() },
	});
}
