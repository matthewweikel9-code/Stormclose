"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function PricingClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard/report";

  async function handleCheckout() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST"
      });

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Something went wrong.";
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade to StormAI Pro</h1>
        <p className="mt-2 text-sm text-slate-600">
          Activate your subscription to unlock report generation and AI assistant tools.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 p-6">
          <p className="text-sm font-medium text-slate-500">Monthly Plan</p>
          <p className="mt-2 text-4xl font-semibold">
            $49<span className="text-base font-normal text-slate-500">/month</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Unlimited AI-generated claim report drafts</li>
            <li>Follow-up and objection response generation</li>
            <li>Fast, secure cloud access</li>
          </ul>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isLoading}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Redirecting to checkout..." : "Start Monthly Plan"}
          </button>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
