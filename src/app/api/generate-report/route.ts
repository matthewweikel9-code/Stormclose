import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateUsageCostUsd, generateInsuranceReport } from "@/lib/ai";
import { checkReportAccess, incrementReportCount } from "@/lib/subscriptions";

export const runtime = "nodejs";

type GenerateReportRequest = {
  propertyAddress: string;
  roofType: string;
  shingleType: string;
  damageNotes: string;
  insuranceCompany: string;
  slopesDamaged: number;
  roofSquares?: number;
};

function isValidPayload(body: unknown): body is GenerateReportRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as Record<string, unknown>;

  return (
    typeof payload.propertyAddress === "string" &&
    typeof payload.roofType === "string" &&
    typeof payload.shingleType === "string" &&
    typeof payload.damageNotes === "string" &&
    typeof payload.insuranceCompany === "string" &&
    typeof payload.slopesDamaged === "number" &&
    (payload.roofSquares === undefined || typeof payload.roofSquares === "number")
  );
}

async function enforceAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // Check report access based on tier and monthly limits
  const access = await checkReportAccess(userId);
  
  if (!access.allowed) {
    return {
      ok: false as const,
      status: 403,
      error: access.reason || "Report limit reached. Upgrade for more reports.",
      remaining: 0
    };
  }

  return { ok: true as const, remaining: access.remaining };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await enforceAccess(supabase, user.id);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await request.json()) as unknown;

    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const payload = {
      propertyAddress: body.propertyAddress.trim(),
      roofType: body.roofType.trim(),
      shingleType: body.shingleType.trim(),
      damageNotes: body.damageNotes.trim(),
      insuranceCompany: body.insuranceCompany.trim(),
      slopesDamaged: body.slopesDamaged,
      roofSquares: body.roofSquares
    };

    if (
      !payload.propertyAddress ||
      !payload.roofType ||
      !payload.shingleType ||
      !payload.damageNotes ||
      !payload.insuranceCompany ||
      !Number.isFinite(payload.slopesDamaged) ||
      payload.slopesDamaged < 0
    ) {
      return NextResponse.json({ error: "Please fill out all required fields correctly." }, { status: 400 });
    }

    // Build scope with roof size if provided
    const scopeItems = [
      `${payload.roofType} roof inspection`,
      `${payload.shingleType} shingle replacement review`,
      `${payload.slopesDamaged} slope(s) affected`
    ];
    
    // Build additional notes with roof size for cost estimation
    const additionalNotesParts = [`Insurance carrier: ${payload.insuranceCompany}`];
    if (payload.roofSquares && payload.roofSquares > 0) {
      additionalNotesParts.push(`Roof size: approximately ${payload.roofSquares} squares (${payload.roofSquares * 100} sq ft)`);
    }

    const aiResult = await generateInsuranceReport({
      companyName: "StormClose AI Roofing",
      customerName: user.email ?? "Homeowner",
      propertyAddress: payload.propertyAddress,
      damageSummary: payload.damageNotes,
      recommendedScope: scopeItems,
      additionalNotes: additionalNotesParts.join(". ")
    });

    const insertPayload = {
      user_id: user.id,
      property_address: payload.propertyAddress,
      roof_type: payload.roofType,
      shingle_type: payload.shingleType,
      damage_notes: payload.damageNotes,
      insurance_company: payload.insuranceCompany,
      slopes_damaged: payload.slopesDamaged,
      report_content: aiResult.content
    };

    const { data: reportRow, error: insertError } = await (supabase
      .from("reports") as any)
      .insert(insertPayload)
      .select("id, report_content, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save report: ${insertError.message}` },
        { status: 500 }
      );
    }

    const estimatedCostUsd = estimateUsageCostUsd(aiResult);

    return NextResponse.json({
      reportId: reportRow.id,
      report: reportRow.report_content,
      createdAt: reportRow.created_at,
      model: aiResult.model,
      usage: aiResult.usage,
      estimatedCostUsd
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
