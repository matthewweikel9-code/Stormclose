"use client";

import { useState, useCallback, useRef } from "react";

interface PhotoAnalysis {
	damageTypes: string[];
	severity: "none" | "minor" | "moderate" | "severe";
	confidenceScore: number;
	description: string;
	recommendations: string[];
	insuranceRelevant: boolean;
}

interface AnalyzedPhoto {
	id: string;
	url: string;
	analysis: PhotoAnalysis;
}

interface PhotoUploadProps {
	reportId?: string;
	onPhotoAnalyzed?: (photo: AnalyzedPhoto) => void;
	disabled?: boolean;
	disabledReason?: string;
}

const SEVERITY_COLORS = {
	none: "bg-green-100 text-green-800",
	minor: "bg-yellow-100 text-yellow-800",
	moderate: "bg-orange-100 text-orange-800",
	severe: "bg-red-100 text-red-800"
};

export function PhotoUpload({
	reportId,
	onPhotoAnalyzed,
	disabled,
	disabledReason
}: PhotoUploadProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [photos, setPhotos] = useState<AnalyzedPhoto[]>([]);
	const [selectedPhoto, setSelectedPhoto] = useState<AnalyzedPhoto | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const analyzePhoto = useCallback(
		async (file: File) => {
			if (disabled) return;

			setIsLoading(true);
			setError(null);

			try {
				const formData = new FormData();
				formData.append("photo", file);
				if (reportId) {
					formData.append("reportId", reportId);
				}

				const response = await fetch("/api/photos/analyze", {
					method: "POST",
					body: formData
				});

				const result = await response.json();

				if (!response.ok) {
					setError(result.error || "Failed to analyze photo");
					return;
				}

				const analyzedPhoto: AnalyzedPhoto = {
					id: result.photoId,
					url: result.photoUrl,
					analysis: result.analysis
				};

				setPhotos((prev) => [...prev, analyzedPhoto]);
				setSelectedPhoto(analyzedPhoto);
				onPhotoAnalyzed?.(analyzedPhoto);
			} catch (err) {
				setError("Failed to analyze photo");
			} finally {
				setIsLoading(false);
			}
		},
		[disabled, reportId, onPhotoAnalyzed]
	);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				analyzePhoto(files[0]);
			}
		},
		[analyzePhoto]
	);

	return (
		<div className="space-y-6">
			{/* Upload Area */}
			<div
				className={`
					relative border-2 border-dashed rounded-xl p-6 text-center transition-all
					${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/50"}
					border-slate-300
				`}
				onClick={() => !disabled && fileInputRef.current?.click()}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onChange={handleFileChange}
					className="hidden"
					disabled={disabled || isLoading}
				/>

				{isLoading ? (
					<div className="flex flex-col items-center gap-3 py-4">
						<div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
						<p className="text-slate-600">Analyzing photo with AI...</p>
					</div>
				) : (
					<div className="flex flex-col items-center gap-3">
						<div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
							<svg
								className="w-6 h-6 text-purple-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
						</div>
						<div>
							<p className="font-medium text-slate-900">
								{disabled ? disabledReason : "Upload roof photo for AI analysis"}
							</p>
							<p className="text-sm text-slate-500 mt-1">
								JPEG, PNG, or WebP • Max 10MB
							</p>
						</div>
					</div>
				)}
			</div>

			{error && (
				<div className="rounded-lg bg-red-50 border border-red-200 p-4">
					<p className="text-sm font-medium text-red-800">{error}</p>
				</div>
			)}

			{/* Photo Grid */}
			{photos.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
					{photos.map((photo) => (
						<button
							key={photo.id}
							type="button"
							onClick={() => setSelectedPhoto(photo)}
							className={`
								relative aspect-square rounded-lg overflow-hidden border-2 transition-all
								${selectedPhoto?.id === photo.id ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300"}
							`}
						>
							<img
								src={photo.url}
								alt="Roof photo"
								className="w-full h-full object-cover"
							/>
							<div
								className={`
									absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-medium
									${SEVERITY_COLORS[photo.analysis.severity]}
								`}
							>
								{photo.analysis.severity.charAt(0).toUpperCase() +
									photo.analysis.severity.slice(1)}
							</div>
						</button>
					))}
				</div>
			)}

			{/* Analysis Details */}
			{selectedPhoto && (
				<div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-slate-900">Analysis Results</h3>
						<span
							className={`px-3 py-1 rounded-full text-sm font-medium ${SEVERITY_COLORS[selectedPhoto.analysis.severity]}`}
						>
							{selectedPhoto.analysis.severity.charAt(0).toUpperCase() +
								selectedPhoto.analysis.severity.slice(1)}{" "}
							Damage
						</span>
					</div>

					<p className="text-slate-600">{selectedPhoto.analysis.description}</p>

					{selectedPhoto.analysis.damageTypes.length > 0 && (
						<div>
							<p className="text-sm font-medium text-slate-700 mb-2">
								Damage Types Detected:
							</p>
							<div className="flex flex-wrap gap-2">
								{selectedPhoto.analysis.damageTypes.map((type) => (
									<span
										key={type}
										className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-sm"
									>
										{type}
									</span>
								))}
							</div>
						</div>
					)}

					{selectedPhoto.analysis.recommendations.length > 0 && (
						<div>
							<p className="text-sm font-medium text-slate-700 mb-2">
								Recommendations:
							</p>
							<ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
								{selectedPhoto.analysis.recommendations.map((rec, i) => (
									<li key={i}>{rec}</li>
								))}
							</ul>
						</div>
					)}

					<div className="flex items-center justify-between pt-3 border-t border-slate-100">
						<span className="text-sm text-slate-500">
							Confidence: {Math.round(selectedPhoto.analysis.confidenceScore * 100)}%
						</span>
						{selectedPhoto.analysis.insuranceRelevant && (
							<span className="text-sm text-emerald-600 font-medium">
								✓ Insurance Relevant
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
