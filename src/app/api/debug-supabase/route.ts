import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronAuth } from "@/lib/server/cron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.ENABLE_DEBUG_ENDPOINTS !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cronAuth = requireCronAuth(request);
  if (!cronAuth.ok) {
    return cronAuth.response;
  }

  const supabaseAdmin = createAdminClient();
  const { count, error: readError } = await (supabaseAdmin.from("users") as any)
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envCheck: {
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
    readTest: {
      success: !readError,
      error: readError?.message ?? null,
      userCount: count ?? 0,
    },
  });
}
