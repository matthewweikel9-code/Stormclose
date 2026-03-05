"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Application error</h2>
            <p className="mt-2 text-slate-600">{error.message || "Unexpected error"}</p>
            <button type="button" onClick={reset} className="button-primary mt-6">
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
