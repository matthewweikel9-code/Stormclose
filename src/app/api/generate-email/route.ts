import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GenerateEmailRequest = {
  customerName: string;
  address: string;
  insuranceCompany: string;
  claimNumber: string;
  reportSummaryText: string;
};

type GeneratedEmail = {
  subject: string;
  body: string;
};

function isValidPayload(value: unknown): value is GenerateEmailRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.customerName === "string" &&
    typeof payload.address === "string" &&
    typeof payload.insuranceCompany === "string" &&
    typeof payload.claimNumber === "string" &&
    typeof payload.reportSummaryText === "string"
  );
}

function isGeneratedEmail(value: unknown): value is GeneratedEmail {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return typeof payload.subject === "string" && typeof payload.body === "string";
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  return new OpenAI({ apiKey });
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
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const payload: GenerateEmailRequest = {
      customerName: body.customerName.trim(),
      address: body.address.trim(),
      insuranceCompany: body.insuranceCompany.trim(),
      claimNumber: body.claimNumber.trim(),
      reportSummaryText: body.reportSummaryText.trim()
    };

    if (
      !payload.customerName ||
      !payload.address ||
      !payload.insuranceCompany ||
      !payload.claimNumber ||
      !payload.reportSummaryText
    ) {
      return NextResponse.json(
        { error: "Please provide all required fields." },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write outbound insurance-claim update emails in a professional insurance adjuster tone. Be concise and factual. Avoid marketing language, hype, and sales language. Return only valid JSON with keys: subject, body."
        },
        {
          role: "user",
          content: [
            `Customer Name: ${payload.customerName}`,
            `Property Address: ${payload.address}`,
            `Insurance Company: ${payload.insuranceCompany}`,
            `Claim Number: ${payload.claimNumber}`,
            "Report Summary:",
            payload.reportSummaryText,
            "Generate an email subject and body suitable for sending to an insurance adjuster."
          ].join("\n")
        }
      ]
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "OpenAI returned an empty response." }, { status: 502 });
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "OpenAI returned invalid JSON output." },
        { status: 502 }
      );
    }

    if (!isGeneratedEmail(parsed)) {
      return NextResponse.json(
        { error: "OpenAI response is missing required subject/body fields." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      subject: parsed.subject.trim(),
      body: parsed.body.trim()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
