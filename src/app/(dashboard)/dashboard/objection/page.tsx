"use client";

import { FormEvent, useMemo, useState } from "react";

type ObjectionFormState = {
  homeownerName: string;
  objection: string;
  projectType: string;
  keyBenefits: string;
  evidencePoints: string;
  tone: "consultative" | "confident" | "empathetic";
};

type ObjectionResponse = {
  objectionId: string;
  content: string;
  createdAt: string;
  model: string;
};

const initialForm: ObjectionFormState = {
  homeownerName: "",
  objection: "",
  projectType: "Roof replacement and insurance claim support",
  keyBenefits: "Licensed crew, insurance documentation support, clean timeline communication",
  evidencePoints: "Recent local installs, carrier-approved supplement success",
  tone: "consultative"
};

export default function ObjectionPage() {
  const [form, setForm] = useState<ObjectionFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ObjectionResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => {
    return form.objection.trim() && form.projectType.trim() && form.keyBenefits.trim();
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate-objection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeownerName: form.homeownerName,
          objection: form.objection,
          projectType: form.projectType,
          keyBenefits: form.keyBenefits
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          evidencePoints: form.evidencePoints
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          tone: form.tone
        })
      });

      const data = (await response.json()) as ObjectionResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate objection response.");
      }

      setResult({
        objectionId: data.objectionId,
        content: data.content,
        createdAt: data.createdAt,
        model: data.model
      });
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
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="saas-shell">
      <header className="saas-page-header">
        <p className="saas-kicker">Sales Enablement</p>
        <h1 className="saas-title">Objection Response Builder</h1>
        <p className="saas-subtitle">
          Build calm, confident responses that handle objections without sounding robotic.
        </p>
      </header>

      <div className="saas-grid">
        <form onSubmit={handleSubmit} className="saas-card space-y-4">
          <label className="saas-label">
            Homeowner name (optional)
            <input
              className="input"
              value={form.homeownerName}
              onChange={(event) => setForm((prev) => ({ ...prev, homeownerName: event.target.value }))}
              placeholder="Jane Smith"
            />
          </label>

          <label className="saas-label">
            Main objection
            <textarea
              className="textarea"
              value={form.objection}
              onChange={(event) => setForm((prev) => ({ ...prev, objection: event.target.value }))}
              placeholder="The quote is higher than another contractor and I want to wait."
              required
            />
          </label>

          <label className="saas-label">
            Project type
            <input
              className="input"
              value={form.projectType}
              onChange={(event) => setForm((prev) => ({ ...prev, projectType: event.target.value }))}
              required
            />
          </label>

          <label className="saas-label">
            Key benefits (comma-separated)
            <input
              className="input"
              value={form.keyBenefits}
              onChange={(event) => setForm((prev) => ({ ...prev, keyBenefits: event.target.value }))}
              required
            />
          </label>

          <label className="saas-label">
            Evidence points (comma-separated)
            <input
              className="input"
              value={form.evidencePoints}
              onChange={(event) => setForm((prev) => ({ ...prev, evidencePoints: event.target.value }))}
            />
          </label>

          <label className="saas-label">
            Response tone
            <select
              className="select"
              value={form.tone}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  tone: event.target.value as "consultative" | "confident" | "empathetic"
                }))
              }
            >
              <option value="consultative">Consultative</option>
              <option value="confident">Confident</option>
              <option value="empathetic">Empathetic</option>
            </select>
          </label>

          {error ? <div className="saas-error">{error}</div> : null}

          <button type="submit" disabled={!canSubmit || loading} className="button-primary w-full">
            {loading ? "Generating response..." : "Generate objection response"}
          </button>
        </form>

        <aside className="saas-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Generated response</h2>
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
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-700" />
            </div>
          ) : result ? (
            <>
              <p className="mb-3 text-xs text-slate-400">
                Response #{result.objectionId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
              </p>
              <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#1F2937] bg-[#0B0F1A] p-4 text-sm leading-6 text-slate-200">
                {result.content}
              </article>
            </>
          ) : (
            <div className="saas-empty">Generated objection response appears here after submission.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
