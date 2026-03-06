"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoUpload } from "@/components/features/PhotoUpload";

interface AnalyzedPhoto {
	id: string;
	url: string;
	analysis: {
		damageTypes: string[];
		severity: "none" | "minor" | "moderate" | "severe";
		confidenceScore: number;
		description: string;
		recommendations: string[];
		insuranceRelevant: boolean;
	};
}

const SEVERITY_COLORS = {
	none: "bg-green-500/20 text-green-400 border-green-500/30",
	minor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
	moderate: "bg-orange-500/20 text-orange-400 border-orange-500/30",
	severe: "bg-red-500/20 text-red-400 border-red-500/30"
};

export function PhotosClient() {
	const router = useRouter();
	const [analyzedPhotos, setAnalyzedPhotos] = useState<AnalyzedPhoto[]>([]);
	const [selectedPhoto, setSelectedPhoto] = useState<AnalyzedPhoto | null>(null);

	const handlePhotoAnalyzed = (photo: AnalyzedPhoto) => {
		setAnalyzedPhotos((prev) => [...prev, photo]);
		setSelectedPhoto(photo);
	};

	const generateReportFromPhotos = () => {
		if (analyzedPhotos.length === 0) return;

		// Combine all photo analyses into damage notes
		const allDamageTypes = new Set<string>();
		const allDescriptions: string[] = [];
		let maxSeverity: "none" | "minor" | "moderate" | "severe" = "none";
		const severityOrder = { none: 0, minor: 1, moderate: 2, severe: 3 };

		analyzedPhotos.forEach((photo) => {
			photo.analysis.damageTypes.forEach((type) => allDamageTypes.add(type));
			allDescriptions.push(photo.analysis.description);
			if (severityOrder[photo.analysis.severity] > severityOrder[maxSeverity]) {
				maxSeverity = photo.analysis.severity;
			}
		});

		// Build comprehensive damage notes from AI analysis
		const damageNotes = [
			`AI Photo Analysis Summary (${analyzedPhotos.length} photo${analyzedPhotos.length > 1 ? "s" : ""} analyzed):`,
			"",
			`Overall Severity: ${maxSeverity.charAt(0).toUpperCase() + maxSeverity.slice(1)}`,
			"",
			"Damage Types Detected:",
			...Array.from(allDamageTypes).map((type) => `• ${type}`),
			"",
			"Detailed Findings:",
			...allDescriptions.map((desc, i) => `${i + 1}. ${desc}`),
		].join("\n");

		// Store in sessionStorage for the report page to pick up
		sessionStorage.setItem("photoAnalysisData", JSON.stringify({
			damageNotes,
			photoIds: analyzedPhotos.map((p) => p.id),
			severity: maxSeverity,
			damageTypes: Array.from(allDamageTypes),
		}));

		// Navigate to report page
		router.push("/dashboard/report?from=photos");
	};

	return (
		<section className="mx-auto max-w-6xl space-y-8">
			<header>
				<p className="text-sm font-medium uppercase tracking-wider text-[#A78BFA]">
					Pro+ Feature
				</p>
				<h1 className="mt-2 text-3xl font-bold text-white">AI Photo Analysis</h1>
				<p className="mt-2 text-slate-400">
					Upload roof damage photos and get instant AI-powered analysis for your insurance
					documentation.
				</p>
			</header>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Upload Section */}
				<div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
					<h2 className="mb-4 text-lg font-semibold text-white">Upload Photos</h2>
					<PhotoUpload onPhotoAnalyzed={handlePhotoAnalyzed} />
				</div>

				{/* Analysis Results */}
				<div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
					<h2 className="mb-4 text-lg font-semibold text-white">Analysis Results</h2>

					{selectedPhoto ? (
						<div className="space-y-4">
							{/* Photo Preview */}
							<div className="overflow-hidden rounded-lg border border-[#1F2937]">
								<img
									src={selectedPhoto.url}
									alt="Analyzed roof"
									className="h-48 w-full object-cover"
								/>
							</div>

							{/* Severity Badge */}
							<div className="flex items-center gap-3">
								<span
									className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${SEVERITY_COLORS[selectedPhoto.analysis.severity]}`}
								>
									{selectedPhoto.analysis.severity} damage
								</span>
								<span className="text-sm text-slate-400">
									{Math.round(selectedPhoto.analysis.confidenceScore * 100)}% confidence
								</span>
							</div>

							{/* Description */}
							<div>
								<h3 className="mb-1 text-sm font-medium text-slate-300">AI Assessment</h3>
								<p className="text-sm text-slate-400">{selectedPhoto.analysis.description}</p>
							</div>

							{/* Damage Types */}
							{selectedPhoto.analysis.damageTypes.length > 0 && (
								<div>
									<h3 className="mb-2 text-sm font-medium text-slate-300">Damage Types Detected</h3>
									<div className="flex flex-wrap gap-2">
										{selectedPhoto.analysis.damageTypes.map((type, idx) => (
											<span
												key={idx}
												className="rounded-lg bg-[#1F2937] px-2 py-1 text-xs text-slate-300"
											>
												{type}
											</span>
										))}
									</div>
								</div>
							)}

							{/* Recommendations */}
							{selectedPhoto.analysis.recommendations.length > 0 && (
								<div>
									<h3 className="mb-2 text-sm font-medium text-slate-300">Recommendations</h3>
									<ul className="space-y-1">
										{selectedPhoto.analysis.recommendations.map((rec, idx) => (
											<li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
												<svg
													className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6D5CFF]"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												{rec}
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Insurance Relevance */}
							{selectedPhoto.analysis.insuranceRelevant && (
								<div className="rounded-lg border border-[#6D5CFF]/30 bg-[#6D5CFF]/10 p-3">
									<p className="text-sm text-[#A78BFA]">
										✓ This photo contains damage relevant for insurance claims
									</p>
								</div>
							)}
						</div>
					) : (
						<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#1F2937]">
							<p className="text-sm text-slate-500">
								Upload a photo to see AI analysis results
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Generate Report CTA */}
			{analyzedPhotos.length > 0 && (
				<div className="rounded-xl border border-[#6D5CFF]/30 bg-gradient-to-r from-[#6D5CFF]/10 via-[#111827] to-[#A78BFA]/10 p-6">
					<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="text-lg font-semibold text-white">
								Ready to Generate a Report?
							</h3>
							<p className="mt-1 text-sm text-slate-400">
								Create an insurance-ready report using AI analysis from{" "}
								{analyzedPhotos.length} photo{analyzedPhotos.length > 1 ? "s" : ""}. 
								Damage notes will be pre-filled automatically.
							</p>
						</div>
						<button
							onClick={generateReportFromPhotos}
							className="inline-flex items-center gap-2 rounded-xl bg-[#6D5CFF] px-6 py-3 font-semibold text-white transition-all hover:bg-[#5B4DE0] hover:shadow-lg hover:shadow-[#6D5CFF]/25"
						>
							<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							Generate Report
						</button>
					</div>
				</div>
			)}

			{/* Photo History */}
			{analyzedPhotos.length > 1 && (
				<div className="rounded-xl border border-[#1F2937] bg-[#111827] p-6">
					<h2 className="mb-4 text-lg font-semibold text-white">Photo History</h2>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{analyzedPhotos.map((photo) => (
							<button
								key={photo.id}
								onClick={() => setSelectedPhoto(photo)}
								className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
									selectedPhoto?.id === photo.id
										? "border-[#6D5CFF]"
										: "border-transparent hover:border-[#1F2937]"
								}`}
							>
								<img
									src={photo.url}
									alt="Analyzed roof"
									className="aspect-square w-full object-cover"
								/>
								<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
									<span
										className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_COLORS[photo.analysis.severity]}`}
									>
										{photo.analysis.severity}
									</span>
								</div>
							</button>
						))}
					</div>
				</div>
			)}
		</section>
	);
}
