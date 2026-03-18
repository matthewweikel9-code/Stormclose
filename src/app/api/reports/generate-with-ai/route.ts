import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInsuranceReport } from "@/lib/ai";

/**
 * POST /api/reports/generate-with-ai
 * Generates an AI insurance report for a property. Optionally saves to reports table.
 * Body: { address: string, lat?: number, lng?: number, homeownerName?: string, saveToReports?: boolean }
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
      address,
      lat = 0,
      lng = 0,
      homeownerName,
      saveToReports = false,
    } = body as {
      address?: string;
      lat?: number;
      lng?: number;
      homeownerName?: string;
      saveToReports?: boolean;
    };

    if (!address || typeof address !== "string" || !address.trim()) {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 }
      );
    }

    // Fetch property data from our generate endpoint (same-origin to preserve auth)
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;
    const params = new URLSearchParams({
      type: "property",
      address: address.trim(),
      lat: String(lat),
      lng: String(lng),
    });
    const cookie = request.headers.get("cookie") || "";
    const propRes = await fetch(`${baseUrl}/api/reports/generate?${params}`, {
      headers: { cookie },
      cache: "no-store",
    }).catch(() => null);

    let propData: {
      address?: string;
      owner?: string;
      roofType?: string;
      roofAge?: number;
      roofSquares?: number;
      stormHistory?: Array<{ date: string; type: string; severity: string }>;
      damageScore?: number;
      estimatedClaimValue?: number;
      message?: string;
    } = {};

    if (propRes?.ok) {
      propData = await propRes.json();
    }

    const owner = homeownerName || propData.owner || "Property Owner";
    const roofType = propData.roofType || "Asphalt shingle";
    const roofAge = propData.roofAge ?? 15;
    const stormHistory = propData.stormHistory || [];
    const damageScore = propData.damageScore ?? 50;
    const estimatedClaim = propData.estimatedClaimValue ?? 15000;

    const damageSummary =
      stormHistory.length > 0
        ? `Storm damage assessment: ${stormHistory.length} storm event(s) in area. Damage score ${damageScore}/100. Roof age ~${roofAge} years. ${roofType} system.`
        : `Property inspection: ${roofType} roof, approximately ${roofAge} years old. Damage score ${damageScore}/100 based on visual assessment.`;

    const recommendedScope =
      damageScore >= 60
        ? ["Full roof replacement per Haag criteria", "Tear-off and disposal", "Code-required upgrades"]
        : damageScore >= 40
          ? ["Targeted repair of damaged areas", "Full replacement if test square confirms functional damage"]
          : ["Inspection and minor repairs as needed"];

    const additionalNotes =
      stormHistory.length > 0
        ? `Storm history: ${stormHistory.map((s) => `${s.date} ${s.type} (${s.severity})`).join("; ")}`
        : undefined;

    const aiInput = {
      companyName: "StormClose AI",
      customerName: owner,
      propertyAddress: propData.address || address,
      damageSummary,
      recommendedScope,
      estimatedCost: estimatedClaim,
      additionalNotes,
    };

    const result = await generateInsuranceReport(aiInput);

    let reportId: string | null = null;
    if (saveToReports) {
      const { data: inserted, error } = await (supabase as any)
        .from("reports")
        .insert({
          user_id: user.id,
          property_address: propData.address || address,
          roof_type: roofType,
          shingle_type: roofType.includes("architectural") ? "Architectural" : "3-Tab",
          damage_notes: damageSummary,
          insurance_company: "To be determined",
          slopes_damaged: 0,
          report_content: result.content,
        })
        .select("id")
        .single();

      if (!error && inserted?.id) {
        reportId = inserted.id;
      }
    }

    return NextResponse.json({
      content: result.content,
      reportId,
      model: result.model,
    });
  } catch (err) {
    console.error("Generate report with AI error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
