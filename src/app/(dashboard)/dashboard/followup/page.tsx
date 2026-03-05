"use client";

import { FormEvent, useState } from "react";

type FollowupStatus = "waiting_on_insurance" | "undecided" | "ghosted";

type FormState = {
  homeownerName: string;
  inspectionDate: string;
  status: FollowupStatus;
};

type FollowupResponse = {
  followupId: string;
  content: string;
  status: FollowupStatus;
  createdAt: string;
  model: string;
};

const statusLabels: Record<FollowupStatus, string> = {
  waiting_on_insurance: "Waiting on insurance",
  undecided: "Undecided",
  ghosted: "Ghosted"
};

export default function FollowupPage() {
  const [form, setForm] = useState<FormState>({
    homeownerName: "",
    inspectionDate: "",
    status: "waiting_on_insurance"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FollowupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as FollowupResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate follow-up.");
      }

      setResult(data);
    } catch (submitError) {
      setResult(null);
      setError(submitError instanceof Error ? submitError.message : "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.content) {
      return;
    }

    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="saas-shell">
      <header className="saas-page-header">
        <p className="saas-kicker">Customer Success</p>
        <h1 className="saas-title">Follow-up Composer</h1>
        <p className="saas-subtitle">
          Generate clean, professional homeowner follow-ups based on deal stage.
        </p>
      </header>

      <div className="saas-grid">
        <form onSubmit={handleSubmit} className="saas-card space-y-4">
          <label className="saas-label">
            Homeowner name
            <input
              className="input"
              value={form.homeownerName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, homeownerName: event.target.value }))
              }
              placeholder="Jane Smith"
              required
            />
          </label>

          <label className="saas-label">
            Inspection date
            <input
              type="date"
              className="input"
              value={form.inspectionDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, inspectionDate: event.target.value }))
              }
              required
            />
          </label>

          <label className="saas-label">
            Status
            <select
              className="select"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as FollowupStatus }))
              }
            >
              <option value="waiting_on_insurance">Waiting on insurance</option>
              <option value="undecided">Undecided</option>
              <option value="ghosted">Ghosted</option>
            </select>
          </label>

          {error ? <div className="saas-error">{error}</div> : null}

          <button
            type="submit"
            disabled={loading || !form.homeownerName || !form.inspectionDate}
            className="button-primary w-full"
          >
            {loading ? "Generating follow-up..." : "Generate follow-up"}
          </button>
        </form>

        <aside className="saas-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Generated message</h2>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!result?.content}
              className="button-secondary disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            </div>
          ) : result ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {statusLabels[result.status]} • #{result.followupId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
              </p>
              <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {result.content}
              </article>
            </>
          ) : (
            <div className="saas-empty">Generated follow-up appears here after submission.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
