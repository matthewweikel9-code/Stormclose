import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateUsageCostUsd, generateObjectionResponse } from "@/lib/ai";

export const runtime = "nodejs";

type Tone = "consultative" | "confident" | "empathetic";

type GenerateObjectionRequest = {
  homeownerName?: string;
  objection: string;
  projectType: string;
  keyBenefits: string[];
  evidencePoints?: string[];
  tone?: Tone;
};

function isValidTone(value: string): value is Tone {
  return value === "consultative" || value === "confident" || value === "empathetic";
}

function isValidPayload(body: unknown): body is GenerateObjectionRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as Record<string, unknown>;

  return (
    typeof payload.objection === "string" &&
    typeof payload.projectType === "string" &&
    Array.isArray(payload.keyBenefits) &&
    (payload.tone === undefined || (typeof payload.tone === "string" && isValidTone(payload.tone)))
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

    const objection = body.objection.trim();
    const projectType = body.projectType.trim();
    const keyBenefits = body.keyBenefits.map((item) => String(item).trim()).filter(Boolean);
    const evidencePoints = (body.evidencePoints ?? [])
      .map((item) => String(item).trim())
      .filter(Boolean);

    if (!objection || !projectType || keyBenefits.length === 0) {
      return NextResponse.json(
        { error: "Please provide objection, project type, and at least one key benefit." },
        { status: 400 }
      );
    }

    const aiResult = await generateObjectionResponse({
      customerName: body.homeownerName?.trim() || undefined,
      objection,
      projectType,
      keyBenefits,
      evidencePoints,
      tone: body.tone ?? "consultative"
    });

    const insertPayload = {
      user_id: user.id,
      homeowner_name: body.homeownerName?.trim() || null,
      objection,
      project_type: projectType,
      key_benefits: keyBenefits,
      evidence_points: evidencePoints,
      tone: body.tone ?? "consultative",
      response_content: aiResult.content
    };

    const { data: objectionRow, error: insertError } = await (supabase
      .from("objections") as any)
      .insert(insertPayload)
      .select("id, response_content, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save objection response: ${insertError.message}` },
        { status: 500 }
      );
    }

    const estimatedCostUsd = estimateUsageCostUsd(aiResult);

    return NextResponse.json({
      objectionId: objectionRow.id,
      content: objectionRow.response_content,
      createdAt: objectionRow.created_at,
      model: aiResult.model,
      usage: aiResult.usage,
      estimatedCostUsd
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate objection response.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
