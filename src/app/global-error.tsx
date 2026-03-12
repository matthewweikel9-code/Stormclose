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
      <body className="bg-storm-bg">
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Application Error</h2>
            <p className="mt-2 text-slate-400">{error.message || "An unexpected error occurred"}</p>
            <button 
              type="button" 
              onClick={reset} 
              className="mt-6 px-6 py-2.5 bg-gradient-to-r from-storm-purple to-storm-glow text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
