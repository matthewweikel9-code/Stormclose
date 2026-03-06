import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCSV, type ParsedCSVRow } from "@/lib/csv";
import { checkFeatureAccess } from "@/lib/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "csv_upload");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		if (!file.name.endsWith(".csv")) {
			return NextResponse.json(
				{ error: "File must be a CSV" },
				{ status: 400 }
			);
		}

		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json(
				{ error: "File size must be less than 5MB" },
				{ status: 400 }
			);
		}

		const csvContent = await file.text();
		const result = parseCSV(csvContent);

		if (!result.success) {
			return NextResponse.json(
				{
					error: "Failed to parse CSV",
					details: result.errors,
					warnings: result.warnings
				},
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			rowCount: result.data.length,
			data: result.data,
			warnings: result.warnings
		});
	} catch (error) {
		console.error("CSV upload error:", error);
		return NextResponse.json(
			{ error: "Failed to process CSV file" },
			{ status: 500 }
		);
	}
}
