import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateUsageCostUsd, generateFollowUp } from "@/lib/ai";

export const runtime = "nodejs";

type FollowupStatus = "waiting_on_insurance" | "undecided" | "ghosted";

type GenerateFollowupRequest = {
  homeownerName: string;
  inspectionDate: string;
  status: FollowupStatus;
};

function isValidStatus(status: string): status is FollowupStatus {
  return status === "waiting_on_insurance" || status === "undecided" || status === "ghosted";
}

function isValidPayload(body: unknown): body is GenerateFollowupRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as Record<string, unknown>;

  return (
    typeof payload.homeownerName === "string" &&
    typeof payload.inspectionDate === "string" &&
    typeof payload.status === "string" &&
    isValidStatus(payload.status)
  );
}

function statusToContext(status: FollowupStatus) {
  if (status === "waiting_on_insurance") {
    return {
      summary: "Homeowner is waiting on their insurance decision before approving scope.",
      nextAction: "Ask for adjuster timeline and offer to coordinate documentation.",
      tone: "professional" as const
    };
  }

  if (status === "ghosted") {
    return {
      summary: "Homeowner has gone silent after inspection and estimate delivery.",
      nextAction: "Prompt for a quick yes/no check-in and offer a short call to answer concerns.",
      tone: "friendly" as const
    };
  }

  return {
    summary: "Homeowner is undecided and comparing options.",
    nextAction: "Reinforce key value points and request a decision conversation this week.",
    tone: "consultative" as const
  };
}

async function enforceAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: billingUser } = (await supabase
    .from("users")
    .select("subscription_status")
    .eq("id", userId)
    .maybeSingle()) as { data: { subscription_status: string | null } | null };

  if (billingUser?.subscription_status !== "active") {
    return {
      ok: false as const,
      status: 403,
      error: "Active subscription required."
    };
  }

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
      status: 429,
      error: "Usage limit exceeded. Free tier allows up to 3 reports."
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

    const homeownerName = body.homeownerName.trim();
    const inspectionDate = body.inspectionDate.trim();
    const status = body.status;

    if (!homeownerName || !inspectionDate) {
      return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
    }

    const context = statusToContext(status);

    const aiResult = await generateFollowUp({
      customerName: homeownerName,
      projectType: "Roof inspection and claim support",
      lastInteractionSummary: `${context.summary} Inspection date: ${inspectionDate}.`,
      nextAction: context.nextAction,
      tone: context.tone === "consultative" ? "professional" : context.tone
    });

    const insertPayload = {
      user_id: user.id,
      homeowner_name: homeownerName,
      inspection_date: inspectionDate,
      status,
      followup_content: aiResult.content
    };

    const { data: followupRow, error: insertError } = await (supabase
      .from("followups") as any)
      .insert(insertPayload)
      .select("id, followup_content, created_at, status")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save follow-up: ${insertError.message}` },
        { status: 500 }
      );
    }

    const estimatedCostUsd = estimateUsageCostUsd(aiResult);

    return NextResponse.json({
      followupId: followupRow.id,
      content: followupRow.followup_content,
      status: followupRow.status,
      createdAt: followupRow.created_at,
      model: aiResult.model,
      usage: aiResult.usage,
      estimatedCostUsd
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate follow-up.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
