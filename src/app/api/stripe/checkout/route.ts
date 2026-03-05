import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSubscriptionCheckoutSession } from "@/lib/stripe/checkout";
import { stripeConfig } from "@/lib/stripe/config";

export const runtime = "nodejs";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
  }

  return normalizeBaseUrl(new URL(request.url).origin);
}

export async function POST(request: Request) {
  if (!stripeConfig.secretKey || !stripeConfig.monthlyPriceId) {
    return NextResponse.json(
      { error: "Stripe is not configured. Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID_MONTHLY." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userRecord } = await supabase
    .from("users")
    .select("id,email,stripe_customer_id,subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const session = await createSubscriptionCheckoutSession({
    userId: user.id,
    email: user.email,
    userRecord,
    appUrl: getRequestOrigin(request),
    upsertUser: async (payload) => {
      await (supabase.from("users") as any).upsert(payload, { onConflict: "id" });
    }
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session URL" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
