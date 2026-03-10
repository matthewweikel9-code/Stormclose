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
    <main className="min-h-screen bg-[#0B0F1A] flex items-center justify-center p-4">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-[#6D5CFF]/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#6D5CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Activate StormClose AI</h1>
          <p className="mt-2 text-slate-400">
            Subscribe to the {tierName} plan to unlock AI-powered roofing workflows.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 text-center">
          <p className="text-sm text-slate-500">{tierName} Plan</p>
          <p className="mt-2 text-3xl font-bold text-white">${price}<span className="text-lg text-slate-400">/month</span></p>
          <p className="mt-1 text-sm text-slate-500">Billed monthly • Cancel anytime</p>
        </div>

        <div className="mt-6">
          <CheckoutButton tier={tier} />
        </div>

        <p className="mt-5 text-sm text-slate-500 text-center">
          Not ready yet?{" "}
          <Link href="/" className="font-semibold text-[#A78BFA] hover:text-[#6D5CFF]">
            Return home
          </Link>
        </p>
      </section>
    </main>
  );
}
