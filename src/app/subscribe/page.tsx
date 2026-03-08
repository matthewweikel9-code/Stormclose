import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton } from "./checkout-button";
import { TIER_PRICES, TIER_DISPLAY_NAMES } from "@/lib/subscriptions/tiers";

type SubscribeTier = "pro" | "pro_plus" | "enterprise";

function isValidTier(tier: string): tier is SubscribeTier {
  return tier === "pro" || tier === "pro_plus" || tier === "enterprise";
}

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/subscribe");
  }

  const { data: billingUser } = (await supabase
    .from("users")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle()) as { data: { subscription_status: string | null } | null };

  if (billingUser?.subscription_status === "active") {
    redirect("/dashboard");
  }

  const tier: SubscribeTier = isValidTier(params.tier || "") ? params.tier as SubscribeTier : "pro";
  const price = TIER_PRICES[tier];
  const tierName = TIER_DISPLAY_NAMES[tier];

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Billing</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Activate StormClose AI</h1>
      <p className="mt-3 text-slate-600">
        Subscribe to the {tierName} plan to unlock AI-powered roofing workflows.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-500">{tierName} plan</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">${price}/month</p>
        <p className="mt-1 text-sm text-slate-600">Billed monthly, cancel any time.</p>
      </div>

      <div className="mt-6">
        <CheckoutButton tier={tier} />
      </div>

      <p className="mt-5 text-sm text-slate-600">
        Not ready yet?{" "}
        <Link href="/" className="font-semibold text-brand-700 hover:text-brand-600">
          Return home
        </Link>
      </p>
    </section>
  );
}
