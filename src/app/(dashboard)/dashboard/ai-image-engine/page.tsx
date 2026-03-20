"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import {
	Camera,
	Loader2,
	AlertCircle,
	CheckCircle2,
	MapPin,
	FileText,
	ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { estimateFromDamageReport } from "@/lib/estimate-engine";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta?: Record<string, unknown> };

interface DamageFinding {
	type: string;
	severity: "low" | "medium" | "high";
	description: string;
	affectedArea?: string;
}

interface DamageReport {
	damageTypes: string[];
	findings: DamageFinding[];
	overallSeverity: "low" | "medium" | "high" | "extensive";
	estimatedAffectedSquares: number;
	repairScope: "spot_repair" | "section_repair" | "full_replacement";
	summary: string;
	recommendations: string[];
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(n);
}

const SEVERITY_COLORS: Record<string, string> = {
	low: "bg-slate-500/20 text-slate-400 border-slate-500/40",
	medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
	high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
	extensive: "bg-red-500/20 text-red-400 border-red-500/40",
};

const REPAIR_SCOPE_LABELS: Record<string, string> = {
	spot_repair: "Spot Repair",
	section_repair: "Section Repair",
	full_replacement: "Full Replacement",
};

export default function AIImageEnginePage() {
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [address, setAddress] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [report, setReport] = useState<DamageReport | null>(null);
	const [estimate, setEstimate] = useState<ReturnType<typeof estimateFromDamageReport> | null>(null);

	const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setError("Please upload an image file (JPEG, PNG, etc.)");
			return;
		}
		setImageFile(file);
		setImagePreview(URL.createObjectURL(file));
		setReport(null);
		setEstimate(null);
		setError(null);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const file = e.dataTransfer.files?.[0];
			if (file?.type.startsWith("image/")) {
				setImageFile(file);
				setImagePreview(URL.createObjectURL(file));
				setReport(null);
				setEstimate(null);
				setError(null);
			}
		},
		[]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const analyzeImage = useCallback(async () => {
		if (!imageFile) {
			setError("Please upload a photo first");
			return;
		}
		setLoading(true);
		setError(null);
		setReport(null);
		setEstimate(null);
		try {
			const reader = new FileReader();
			const base64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => {
					const result = reader.result as string;
					const base64 = result?.replace(/^data:image\/\w+;base64,/, "") ?? "";
					resolve(base64);
				};
				reader.onerror = reject;
				reader.readAsDataURL(imageFile);
			});

			const res = await fetch("/api/ai/damage-analysis", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ imageBase64: base64 }),
			});

			const json = (await res.json()) as ApiEnvelope<{ report: DamageReport }>;
			if (!res.ok) {
				throw new Error(json.error || "Analysis failed");
			}

			const damageReport = json.data?.report;
			if (!damageReport) {
				throw new Error("No report returned");
			}

			setReport(damageReport);

			if (damageReport.estimatedAffectedSquares > 0) {
				const est = estimateFromDamageReport({
					estimatedAffectedSquares: damageReport.estimatedAffectedSquares,
					repairScope: damageReport.repairScope,
				});
				setEstimate(est);
			} else {
				setEstimate(null);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Analysis failed");
		} finally {
			setLoading(false);
		}
	}, [imageFile]);

	const reset = useCallback(() => {
		setImageFile(null);
		if (imagePreview) URL.revokeObjectURL(imagePreview);
		setImagePreview(null);
		setReport(null);
		setEstimate(null);
		setError(null);
	}, [imagePreview]);

	return (
		<div className="space-y-6 pb-8">
			{/* Header */}
			<section className="storm-card-glow border-storm-purple/20">
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-storm-purple/40 to-transparent" />
				<div className="p-6">
					<div className="flex items-center gap-4 mb-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-storm-purple/20 to-storm-glow/10 shadow-glow-sm">
							<Camera className="h-6 w-6 text-storm-glow" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-white tracking-tight">AI Image Engine</h1>
							<p className="text-sm text-storm-muted">
								Upload a photo of a roof or property. AI detects storm damage and generates a damage report with cost estimate.
							</p>
						</div>
					</div>

					{/* Address (optional) */}
					<div className="mb-4">
						<label className="block text-xs font-medium text-storm-subtle mb-1.5">Property address (optional)</label>
						<div className="relative">
							<input
								type="text"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="123 Oak St, Dallas TX"
								className="input w-full pl-10"
							/>
							<MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-storm-subtle" />
						</div>
						<p className="text-2xs text-storm-subtle mt-1">
							Add address to combine with roof measurement for a more accurate estimate.
						</p>
					</div>

					{/* Upload area */}
					<div
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						className={`relative rounded-xl border-2 border-dashed transition-colors ${
							imagePreview
								? "border-storm-purple/40 bg-storm-purple/5"
								: "border-storm-border hover:border-storm-purple/30 bg-storm-z1/30"
						}`}
					>
						<input
							type="file"
							accept="image/*"
							onChange={handleFileChange}
							className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
						/>
						{imagePreview ? (
							<div className="p-4 flex flex-col sm:flex-row gap-4 items-start">
								<img
									src={imagePreview}
									alt="Upload preview"
									className="w-full sm:w-48 h-32 object-cover rounded-lg border border-storm-border"
								/>
								<div className="flex-1">
									<p className="text-sm text-white font-medium">{imageFile?.name}</p>
									<p className="text-2xs text-storm-muted mt-1">Click or drag a new image to replace</p>
									<div className="flex gap-2 mt-3">
										<button
											onClick={(e) => {
												e.preventDefault();
												void analyzeImage();
											}}
											disabled={loading}
											className="btn-primary flex items-center gap-2 text-sm"
										>
											{loading ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Camera className="h-4 w-4" />
											)}
											{loading ? "Analyzing..." : "Analyze Damage"}
										</button>
										<button onClick={reset} className="button-secondary text-sm">
											Clear
										</button>
									</div>
								</div>
							</div>
						) : (
							<div className="p-12 text-center">
								<Camera className="h-12 w-12 text-storm-subtle mx-auto mb-3" />
								<p className="text-sm text-white font-medium">Drop a photo here or click to upload</p>
								<p className="text-2xs text-storm-muted mt-1">Roof close-up, ground shot, or aerial view</p>
							</div>
						)}
					</div>

					{error && (
						<div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
							<AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
							<p className="text-sm text-red-300">{error}</p>
						</div>
					)}
				</div>
			</section>

			{/* Results */}
			{report && (
				<section className="storm-card border-storm-border/30">
					<div className="p-6">
						<h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-emerald-400" />
							Damage Report
						</h2>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
							<div className="rounded-xl bg-storm-z1/60 border border-storm-border/20 p-3">
								<p className="text-2xs text-storm-subtle uppercase tracking-wider">Severity</p>
								<Badge
									className={`mt-1 ${SEVERITY_COLORS[report.overallSeverity] ?? SEVERITY_COLORS.low}`}
								>
									{report.overallSeverity}
								</Badge>
							</div>
							<div className="rounded-xl bg-storm-z1/60 border border-storm-border/20 p-3">
								<p className="text-2xs text-storm-subtle uppercase tracking-wider">Repair Scope</p>
								<p className="mt-1 text-sm font-semibold text-white">
									{REPAIR_SCOPE_LABELS[report.repairScope] ?? report.repairScope}
								</p>
							</div>
							<div className="rounded-xl bg-storm-z1/60 border border-storm-border/20 p-3">
								<p className="text-2xs text-storm-subtle uppercase tracking-wider">Est. Affected</p>
								<p className="mt-1 text-sm font-semibold text-white">
									{report.estimatedAffectedSquares} sq
								</p>
							</div>
						</div>

						<p className="text-sm text-storm-muted mb-4">{report.summary}</p>

						{report.findings.length > 0 && (
							<div className="mb-6">
								<h3 className="text-sm font-semibold text-white mb-2">Findings</h3>
								<ul className="space-y-2">
									{report.findings.map((f, i) => (
										<li
											key={i}
											className="flex items-start gap-2 p-2 rounded-lg bg-storm-z1/50 border border-storm-border/20"
										>
											<Badge className={`shrink-0 ${SEVERITY_COLORS[f.severity] ?? ""}`}>
												{f.severity}
											</Badge>
											<div>
												<p className="text-sm text-white font-medium">{f.type}</p>
												<p className="text-2xs text-storm-muted">{f.description}</p>
												{f.affectedArea && (
													<p className="text-2xs text-storm-subtle mt-0.5">{f.affectedArea}</p>
												)}
											</div>
										</li>
									))}
								</ul>
							</div>
						)}

						{report.recommendations.length > 0 && (
							<div className="mb-6">
								<h3 className="text-sm font-semibold text-white mb-2">Recommendations</h3>
								<ul className="list-disc list-inside space-y-1 text-sm text-storm-muted">
									{report.recommendations.map((r, i) => (
										<li key={i}>{r}</li>
									))}
								</ul>
							</div>
						)}

						{estimate && (
							<div className="rounded-xl bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 border border-storm-purple/20 p-4 mb-6">
								<h3 className="text-sm font-semibold text-white mb-3">Cost Estimate</h3>
								<div className="flex items-baseline gap-2 mb-2">
									<span className="text-2xl font-bold text-white">
										{formatCurrency(estimate.costRange.low)} – {formatCurrency(estimate.costRange.high)}
									</span>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs text-storm-muted">
									<div>Shingle bundles: {estimate.materials.shingleBundles}</div>
									<div>Underlayment rolls: {estimate.materials.underlaymentRolls}</div>
									<div>Ridge cap: {estimate.materials.ridgeCapBundles}</div>
									<div>Drip edge: {estimate.materials.dripEdgeFeet} ft</div>
								</div>
							</div>
						)}

						<div className="flex flex-wrap gap-2">
							<Link
								href="/dashboard/smart-route"
								className="button-secondary flex items-center gap-2 text-sm"
							>
								<ExternalLink className="h-4 w-4" />
								Add to Route
							</Link>
							<Link
								href="/dashboard/leads"
								className="button-secondary flex items-center gap-2 text-sm"
							>
								<FileText className="h-4 w-4" />
								Create Lead
							</Link>
						</div>
					</div>
				</section>
			)}

			{!report && !loading && (
				<section className="storm-card border-storm-border/20 p-8 text-center">
					<Camera className="h-12 w-12 text-storm-subtle mx-auto mb-3" />
					<p className="text-sm text-storm-muted">Upload a photo and click Analyze to get started.</p>
				</section>
			)}
		</div>
	);
}
