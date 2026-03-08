"use client";

import { useState } from "react";

interface CheckoutButtonProps {
  tier?: "pro" | "pro_plus" | "enterprise";
}

export function CheckoutButton({ tier = "pro" }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier })
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to create checkout session");
      }

      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start checkout");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onCheckout} disabled={loading} className="button-primary w-full">
        {loading ? "Redirecting..." : "Start subscription"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
