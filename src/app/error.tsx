"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-slate-600">Please try again.</p>
      <button type="button" onClick={reset} className="button-primary mt-6">
        Try again
      </button>
    </div>
  );
}
