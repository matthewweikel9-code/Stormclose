"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader, Card, Button } from "@/components/dashboard";

type ReportFormState = {
  propertyAddress: string;
  roofType: string;
  shingleType: string;
  damageNotes: string;
  insuranceCompany: string;
  claimNumber: string;
  slopesDamaged: string;
  roofSquares: string;
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
  slopesDamaged: "",
  roofSquares: ""
};

export default function ReportPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ReportFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [emailDraft, setEmailDraft] = useState<GenerateEmailResponse | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoDataLoaded, setPhotoDataLoaded] = useState(false);

  // Load photo analysis data if coming from photos page
  useEffect(() => {
    if (searchParams.get("from") === "photos" && !photoDataLoaded) {
      try {
        const photoData = sessionStorage.getItem("photoAnalysisData");
        if (photoData) {
          const parsed = JSON.parse(photoData);
          setForm((prev) => ({
            ...prev,
            damageNotes: parsed.damageNotes || prev.damageNotes
          }));
          // Clear the data after loading
          sessionStorage.removeItem("photoAnalysisData");
          setPhotoDataLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load photo analysis data:", e);
      }
    }
  }, [searchParams, photoDataLoaded]);

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
          slopesDamaged: Number(form.slopesDamaged),
          roofSquares: form.roofSquares ? Number(form.roofSquares) : undefined
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Reports"
        title="Insurance Report Builder"
        description="Fill in the claim details and generate a polished report you can send to the carrier."
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Form Card */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Property address
                </span>
                <input
                  className="dashboard-input"
                  value={form.propertyAddress}
                  onChange={(event) => setForm((prev) => ({ ...prev, propertyAddress: event.target.value }))}
                  placeholder="123 Main St, Dallas, TX"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Roof type
                </span>
                <input
                  className="dashboard-input"
                  value={form.roofType}
                  onChange={(event) => setForm((prev) => ({ ...prev, roofType: event.target.value }))}
                  placeholder="Gable"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Shingle type
                </span>
                <input
                  className="dashboard-input"
                  value={form.shingleType}
                  onChange={(event) => setForm((prev) => ({ ...prev, shingleType: event.target.value }))}
                  placeholder="Architectural asphalt"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Insurance company
                </span>
                <input
                  className="dashboard-input"
                  value={form.insuranceCompany}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, insuranceCompany: event.target.value }))
                  }
                  placeholder="State Farm"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Claim number
                </span>
                <input
                  className="dashboard-input"
                  value={form.claimNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, claimNumber: event.target.value }))}
                  placeholder="CLM-123456"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Slopes damaged
                </span>
                <input
                  type="number"
                  min={0}
                  className="dashboard-input"
                  value={form.slopesDamaged}
                  onChange={(event) => setForm((prev) => ({ ...prev, slopesDamaged: event.target.value }))}
                  placeholder="2"
                  required
                />
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Roof size (squares)
                </span>
                <input
                  type="number"
                  min={1}
                  className="dashboard-input"
                  value={form.roofSquares}
                  onChange={(event) => setForm((prev) => ({ ...prev, roofSquares: event.target.value }))}
                  placeholder="25 (1 sq = 100 sq ft)"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Optional – helps generate accurate cost estimates
                </span>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">
                  Damage notes
                </span>
                <textarea
                  className="dashboard-input min-h-28 resize-y"
                  value={form.damageNotes}
                  onChange={(event) => setForm((prev) => ({ ...prev, damageNotes: event.target.value }))}
                  placeholder="Granule loss, hail bruising, ridge cap impact, lifted tabs on west-facing slope..."
                  required
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit || loading}
              isLoading={loading}
              className="w-full"
            >
              {loading ? "Generating report..." : "Generate report"}
            </Button>
          </form>
        </Card>

        {/* Output Card */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Generated output</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={!result?.report}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={!result || csvLoading || loading}
              isLoading={csvLoading}
            >
              {csvLoading ? "Downloading..." : "Download CSV"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateEmailDraft}
              disabled={!result || emailLoading || loading}
              isLoading={emailLoading}
            >
              {emailLoading ? "Generating..." : "Generate Email"}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-700" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-700" />
            </div>
          ) : result ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="mb-3 text-xs text-slate-500">
                Report #{result.reportId.slice(0, 8)} • {new Date(result.createdAt).toLocaleString()}
              </p>
              <article className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#1F2937] bg-[#0B0F1A] p-4 text-sm leading-6 text-slate-300">
                {result.report}
              </article>

              {emailDraft && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 space-y-2 rounded-xl border border-[#1F2937] bg-[#0B0F1A] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#A78BFA]">
                    Email draft
                  </p>
                  <p className="text-sm font-semibold text-white">
                    Subject: {emailDraft.subject}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {emailDraft.body}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#1F2937] bg-[#0B0F1A]/50 p-6 text-center text-sm text-slate-500">
              Generated report appears here after submission.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
