import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateUsageCostUsd, generateInsuranceReport } from "@/lib/ai";

export const runtime = "nodejs";

type GenerateReportRequest = {
  propertyAddress: string;
  roofType: string;
  shingleType: string;
  damageNotes: string;
  insuranceCompany: string;
  slopesDamaged: number;
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
    typeof payload.slopesDamaged === "number"
  );
}

async function enforceAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: billingUser } = (await supabase
    .from("users")
    .select("subscription_status")
    .eq("id", userId)
    .maybeSingle()) as { data: { subscription_status: string | null } | null };

  const isActive = billingUser?.subscription_status === "active";

  // Active subscribers have unlimited access
  if (isActive) {
    return { ok: true as const };
  }

  // Free tier: enforce 3-report limit
  const { count, error } = await (supabase
    .from("reports") as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to check usage limit: ${error.message}`);
  }

  if ((count ?? 0) >= 3) {
    return {
      ok: false as const,
      status: 403,
      error: "Free tier limit reached. Subscribe for unlimited access."
    };
  }

  return { ok: true as const };
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
      slopesDamaged: body.slopesDamaged
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

    const aiResult = await generateInsuranceReport({
      companyName: "StormClose AI Roofing",
      customerName: user.email ?? "Homeowner",
      propertyAddress: payload.propertyAddress,
      damageSummary: payload.damageNotes,
      recommendedScope: [
        `${payload.roofType} roof inspection`,
        `${payload.shingleType} shingle replacement review`,
        `${payload.slopesDamaged} slope(s) affected`
      ],
      additionalNotes: `Insurance carrier: ${payload.insuranceCompany}`
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
