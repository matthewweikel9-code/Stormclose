import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SuccessPageProps = {
  searchParams?: {
    session_id?: string;
  };
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/success");
  }

  const { data: billingUser } = (await supabase
    .from("users")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle()) as { data: { subscription_status: string | null } | null };

  const subscriptionStatus = billingUser?.subscription_status ?? "inactive";
  const isActive = subscriptionStatus === "active";
  const sessionId = searchParams?.session_id;

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Billing</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Checkout complete</h1>
      <p className="mt-3 text-slate-600">
        {isActive
          ? "Your subscription is active and your account is ready to use."
          : "Your payment was received. Subscription activation can take a few seconds while Stripe webhook events finish syncing."}
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-500">Subscription status</p>
        <p
          className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {subscriptionStatus}
        </p>
        {sessionId ? <p className="mt-3 text-xs text-slate-500">Session: {sessionId}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className="button-primary">
          Go to dashboard
        </Link>
        {!isActive ? (
          <Link href="/success" className="button-secondary">
            Refresh status
          </Link>
        ) : null}
      </div>

      {!isActive ? (
        <p className="mt-4 text-sm text-slate-600">
          If status stays inactive, confirm your Stripe webhook endpoint points to
          <span className="font-medium text-slate-900"> /api/stripe/webhook</span> and that
          <span className="font-medium text-slate-900"> STRIPE_WEBHOOK_SECRET</span> matches Stripe.
        </p>
      ) : null}
    </section>
  );
}
