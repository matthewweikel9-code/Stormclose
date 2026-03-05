import { Suspense } from "react";
import { PricingClient } from "./pricing-client";

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <PricingClient />
    </Suspense>
  );
}
