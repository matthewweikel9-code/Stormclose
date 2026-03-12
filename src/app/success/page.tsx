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
    <main className="min-h-screen bg-storm-bg flex items-center justify-center p-4">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
        <div className="text-center mb-6">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isActive ? "bg-emerald-500/10" : "bg-amber-500/10"
          }`}>
            {isActive ? (
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isActive ? "Welcome to StormClose AI!" : "Processing Payment..."}
          </h1>
          <p className="mt-2 text-slate-400">
            {isActive
              ? "Your subscription is active and your account is ready to use."
              : "Your payment was received. Activation takes a few seconds while we sync with Stripe."}
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-center">
          <p className="text-sm text-slate-500">Subscription Status</p>
          <p
            className={`mt-2 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${
              isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
          </p>
          {sessionId && (
            <p className="mt-3 text-xs text-slate-600 truncate">Session: {sessionId}</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link 
            href="/dashboard" 
            className="w-full py-3 text-center bg-gradient-to-r from-storm-purple to-storm-glow text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
          {!isActive && (
            <Link 
              href="/success" 
              className="w-full py-3 text-center border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Refresh Status
            </Link>
          )}
        </div>

        {!isActive && (
          <p className="mt-4 text-xs text-slate-500 text-center">
            If status stays inactive, please contact support or check your email for confirmation.
          </p>
        )}
      </section>
    </main>
  );
}
