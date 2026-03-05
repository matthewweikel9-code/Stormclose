"use client";

import { FormEvent, useMemo, useState } from "react";

type ReportFormState = {
  propertyAddress: string;
  roofType: string;
  shingleType: string;
  damageNotes: string;
  insuranceCompany: string;
  claimNumber: string;
  slopesDamaged: string;
};

type GenerateResponse = {
  reportId: string;
  report: string;
  createdAt: string;
  model: string;
};

type GenerateEmailResponse = {
  subject: string;
  body: string;
  error?: string;
};

const initialForm: ReportFormState = {
  propertyAddress: "",
  roofType: "",
  shingleType: "",
  damageNotes: "",
  insuranceCompany: "",
  claimNumber: "",
  slopesDamaged: ""
};

export default function ReportPage() {
  const [form, setForm] = useState<ReportFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [emailDraft, setEmailDraft] = useState<GenerateEmailResponse | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.propertyAddress.trim() &&
      form.roofType.trim() &&
      form.shingleType.trim() &&
      form.damageNotes.trim() &&
      form.insuranceCompany.trim() &&
      form.claimNumber.trim() &&
      form.slopesDamaged.trim()
    );
  }, [form]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);
    setEmailDraft(null);

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          propertyAddress: form.propertyAddress,
          roofType: form.roofType,
          shingleType: form.shingleType,
          damageNotes: form.damageNotes,
          insuranceCompany: form.insuranceCompany,
          slopesDamaged: Number(form.slopesDamaged)
        })
      });

      const data = (await response.json()) as GenerateResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate report.");
      }

      setResult({
        reportId: data.reportId,
        report: data.report,
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
    if (!result?.report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy report to clipboard.");
    }
  }

  async function handleDownloadCsv() {
    if (!result) {
      return;
    }

    setCsvLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/download-report-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reportData: {
            reportId: result.reportId,
            customerName: "Homeowner",
            address: form.propertyAddress,
            insuranceCompany: form.insuranceCompany,
            claimNumber: form.claimNumber,
            reportSummaryText: result.report,
            createdAt: result.createdAt,
            model: result.model
          }
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to download CSV.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "claim_report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download CSV.");
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleGenerateEmailDraft() {
    if (!result) {
      return;
    }

    setEmailLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerName: "Homeowner",
          address: form.propertyAddress,
          insuranceCompany: form.insuranceCompany,
          claimNumber: form.claimNumber,
          reportSummaryText: result.report
        })
      });

      const data = (await response.json()) as GenerateEmailResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate email draft.");
      }

      setEmailDraft({
        subject: data.subject,
        body: data.body
      });
    } catch (emailError) {
      setEmailDraft(null);
      setError(emailError instanceof Error ? emailError.message : "Failed to generate email draft.");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <section className="saas-shell">
      <header className="saas-page-header">
        <p className="saas-kicker">Reports</p>
        <h1 className="saas-title">Insurance Report Builder</h1>
        <p className="saas-subtitle">
          Fill in the claim details and generate a polished report you can send to the carrier.
        </p>
      </header>

      <div className="saas-grid">
        <form onSubmit={handleSubmit} className="saas-card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="saas-label sm:col-span-2">
              Property address
              <input
                className="input"
                value={form.propertyAddress}
                onChange={(event) => setForm((prev) => ({ ...prev, propertyAddress: event.target.value }))}
                placeholder="123 Main St, Dallas, TX"
                required
              />
            </label>

            <label className="saas-label">
              Roof type
              <input
                className="input"
                value={form.roofType}
                onChange={(event) => setForm((prev) => ({ ...prev, roofType: event.target.value }))}
                placeholder="Gable"
                required
              />
            </label>

            <label className="saas-label">
              Shingle type
              <input
                className="input"
                value={form.shingleType}
                onChange={(event) => setForm((prev) => ({ ...prev, shingleType: event.target.value }))}
                placeholder="Architectural asphalt"
                required
              />
            </label>

            <label className="saas-label">
              Insurance company
              <input
                className="input"
                value={form.insuranceCompany}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, insuranceCompany: event.target.value }))
                }
                placeholder="State Farm"
                required
              />
            </label>

            <label className="saas-label">
              Claim number
              <input
                className="input"
                value={form.claimNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, claimNumber: event.target.value }))}
                placeholder="CLM-123456"
                required
              />
            </label>

            <label className="saas-label">
              Slopes damaged
              <input
                type="number"
                min={0}
                className="input"
                value={form.slopesDamaged}
                onChange={(event) => setForm((prev) => ({ ...prev, slopesDamaged: event.target.value }))}
                placeholder="2"
                required
              />
            </label>

            <label className="saas-label sm:col-span-2">
              Damage notes
              <textarea
                className="textarea"
                value={form.damageNotes}
                onChange={(event) => setForm((prev) => ({ ...prev, damageNotes: event.target.value }))}
                placeholder="Granule loss, hail bruising, ridge cap impact, lifted tabs on west-facing slope..."
                required
              />
            </label>
          </div>

          {error ? <div className="saas-error">{error}</div> : null}

          <button type="submit" disabled={!canSubmit || loading} className="button-primary w-full">
            {loading ? "Generating report..." : "Generate report"}
          </button>
        </form>

        <aside className="saas-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Generated output</h2>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!result?.report}
              className="button-secondary disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!result || csvLoading || loading}
              className="button-secondary disabled:opacity-50"
            >
              {csvLoading ? "Downloading CSV..." : "Download CSV"}
            </button>

            <button
              type="button"
              onClick={handleGenerateEmailDraft}
              disabled={!result || emailLoading || loading}
              className="button-secondary disabled:opacity-50"
            >
              {emailLoading ? "Generating email..." : "Generate Email Draft"}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
            </div>
          ) : result ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                Report #{result.reportId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
              </p>
              <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {result.report}
              </article>

              {emailDraft ? (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email draft</p>
                  <p className="text-sm font-semibold text-slate-900">Subject: {emailDraft.subject}</p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{emailDraft.body}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="saas-empty">Generated report appears here after submission.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
