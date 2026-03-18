import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports
 * List user's AI-generated inspection reports.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: reports, error } = await (supabase as any)
      .from("reports")
      .select("id, property_address, roof_type, shingle_type, damage_notes, insurance_company, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Reports fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (err) {
    console.error("Reports API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/reports
 * Save an AI-generated report to the database.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      property_address,
      roof_type = "Asphalt shingle",
      shingle_type = "Architectural",
      damage_notes = "AI-generated damage assessment",
      insurance_company = "To be determined",
      report_content,
    } = body;

    if (!property_address || !report_content) {
      return NextResponse.json(
        { error: "property_address and report_content are required" },
        { status: 400 }
      );
    }

    const { data: report, error } = await (supabase as any)
      .from("reports")
      .insert({
        user_id: user.id,
        property_address: String(property_address).trim(),
        roof_type: String(roof_type || "Asphalt shingle"),
        shingle_type: String(shingle_type || "Architectural"),
        damage_notes: String(damage_notes || "AI-generated damage assessment"),
        insurance_company: String(insurance_company || "To be determined"),
        slopes_damaged: 0,
        report_content: String(report_content),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Report save error:", error);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    return NextResponse.json({ report: { id: report.id } });
  } catch (err) {
    console.error("Reports POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
