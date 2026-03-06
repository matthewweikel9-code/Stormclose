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

interface PendingPhoto {
	id: string;
	file: File;
	preview: string;
	status: "pending" | "analyzing" | "complete" | "error";
	error?: string;
}

interface PhotoUploadProps {
	reportId?: string;
	onPhotoAnalyzed?: (photo: AnalyzedPhoto) => void;
	onBatchComplete?: (photos: AnalyzedPhoto[]) => void;
	disabled?: boolean;
	disabledReason?: string;
	maxFiles?: number;
}

const SEVERITY_COLORS = {
	none: "bg-green-100 text-green-800",
	minor: "bg-yellow-100 text-yellow-800",
	moderate: "bg-orange-100 text-orange-800",
	severe: "bg-red-100 text-red-800"
};

const MAX_CONCURRENT = 2; // Process 2 photos at a time

export function PhotoUpload({
	reportId,
	onPhotoAnalyzed,
	onBatchComplete,
	disabled,
	disabledReason,
	maxFiles = 10
}: PhotoUploadProps) {
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [photos, setPhotos] = useState<AnalyzedPhoto[]>([]);
	const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
	const [selectedPhoto, setSelectedPhoto] = useState<AnalyzedPhoto | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const processingRef = useRef(false);

	const analyzePhoto = useCallback(
		async (pendingPhoto: PendingPhoto): Promise<AnalyzedPhoto | null> => {
			try {
				const formData = new FormData();
				formData.append("photo", pendingPhoto.file);
				if (reportId) {
					formData.append("reportId", reportId);
				}

				const response = await fetch("/api/photos/analyze", {
					method: "POST",
					body: formData
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || "Failed to analyze photo");
				}

				const analyzedPhoto: AnalyzedPhoto = {
					id: result.photoId || pendingPhoto.id,
					url: result.photoUrl || pendingPhoto.preview,
					analysis: result.analysis
				};

				return analyzedPhoto;
			} catch (err) {
				throw err;
			}
		},
		[reportId]
	);

	const processQueue = useCallback(async () => {
		if (processingRef.current) return;
		processingRef.current = true;
		setIsProcessing(true);

		const completedPhotos: AnalyzedPhoto[] = [];

		while (true) {
			// Get pending photos that need processing
			const pending = pendingPhotos.filter(p => p.status === "pending");
			if (pending.length === 0) break;

			// Process up to MAX_CONCURRENT at a time
			const batch = pending.slice(0, MAX_CONCURRENT);
			
			// Mark as analyzing
			setPendingPhotos(prev => prev.map(p => 
				batch.find(b => b.id === p.id) ? { ...p, status: "analyzing" as const } : p
			));

			// Process batch
			const results = await Promise.allSettled(
				batch.map(async (p) => {
					const result = await analyzePhoto(p);
					return { pending: p, result };
				})
			);

			// Update states based on results
			for (const outcome of results) {
				if (outcome.status === "fulfilled" && outcome.value.result) {
					const { pending: p, result } = outcome.value;
					
					setPendingPhotos(prev => prev.map(photo => 
						photo.id === p.id ? { ...photo, status: "complete" as const } : photo
					));
					
					setPhotos(prev => [...prev, result]);
					completedPhotos.push(result);
					onPhotoAnalyzed?.(result);
				} else {
					const pendingId = outcome.status === "fulfilled" 
						? outcome.value.pending.id 
						: batch[results.indexOf(outcome)]?.id;
					const errorMsg = outcome.status === "rejected" 
						? (outcome.reason as Error).message 
						: "Analysis failed";
					
					setPendingPhotos(prev => prev.map(photo => 
						photo.id === pendingId ? { ...photo, status: "error" as const, error: errorMsg } : photo
					));
				}
			}

			// Refresh pending state for next iteration
			setPendingPhotos(prev => {
				const stillPending = prev.filter(p => p.status === "pending");
				if (stillPending.length === 0) {
					// All done - clean up completed after a delay
					setTimeout(() => {
						setPendingPhotos(current => current.filter(p => p.status === "error"));
					}, 2000);
				}
				return prev;
			});
		}

		processingRef.current = false;
		setIsProcessing(false);

		if (completedPhotos.length > 0) {
			onBatchComplete?.(completedPhotos);
		}
	}, [pendingPhotos, analyzePhoto, onPhotoAnalyzed, onBatchComplete]);

	const addFiles = useCallback((files: FileList | File[]) => {
		if (disabled) return;
		setError(null);

		const fileArray = Array.from(files);
		const validTypes = ["image/jpeg", "image/png", "image/webp"];
		const maxSize = 10 * 1024 * 1024; // 10MB

		// Filter and validate files
		const validFiles: File[] = [];
		const errors: string[] = [];

		for (const file of fileArray) {
			if (!validTypes.includes(file.type)) {
				errors.push(`${file.name}: Invalid file type`);
				continue;
			}
			if (file.size > maxSize) {
				errors.push(`${file.name}: File too large (max 10MB)`);
				continue;
			}
			validFiles.push(file);
		}

		// Check max files limit
		const remaining = maxFiles - photos.length - pendingPhotos.length;
		if (validFiles.length > remaining) {
			errors.push(`Only ${remaining} more photo(s) allowed`);
			validFiles.splice(remaining);
		}

		if (errors.length > 0) {
			setError(errors.join("; "));
		}

		if (validFiles.length === 0) return;

		// Create pending photo entries
		const newPending: PendingPhoto[] = validFiles.map((file, idx) => ({
			id: `pending-${Date.now()}-${idx}`,
			file,
			preview: URL.createObjectURL(file),
			status: "pending" as const
		}));

		setPendingPhotos(prev => [...prev, ...newPending]);
		
		// Start processing queue
		setTimeout(() => processQueue(), 100);
	}, [disabled, maxFiles, photos.length, pendingPhotos.length, processQueue]);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				addFiles(files);
			}
			// Reset input so same files can be selected again
			e.target.value = "";
		},
		[addFiles]
	);

	const handleDrag = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (disabled) return;

		const files = e.dataTransfer.files;
		if (files && files.length > 0) {
			addFiles(files);
		}
	}, [disabled, addFiles]);

	const removePhoto = useCallback((id: string) => {
		setPendingPhotos(prev => {
			const photo = prev.find(p => p.id === id);
			if (photo?.preview) {
				URL.revokeObjectURL(photo.preview);
			}
			return prev.filter(p => p.id !== id);
		});
	}, []);

	const completedCount = pendingPhotos.filter(p => p.status === "complete").length;
	const totalPending = pendingPhotos.length;
	const progress = totalPending > 0 ? Math.round((completedCount / totalPending) * 100) : 0;

	return (
		<div className="space-y-6">
			{/* Upload Area with Drag & Drop */}
			<div
				className={`
					relative border-2 border-dashed rounded-xl p-6 text-center transition-all
					${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/50"}
					${dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300"}
				`}
				onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
				onDragEnter={handleDrag}
				onDragLeave={handleDrag}
				onDragOver={handleDrag}
				onDrop={handleDrop}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					multiple
					onChange={handleFileChange}
					className="hidden"
					disabled={disabled || isProcessing}
				/>

				{isProcessing && pendingPhotos.length > 0 ? (
					<div className="flex flex-col items-center gap-3 py-4">
						<div className="w-full max-w-xs">
							<div className="flex justify-between text-sm text-slate-600 mb-2">
								<span>Analyzing {pendingPhotos.filter(p => p.status === "analyzing").length} photos...</span>
								<span>{completedCount}/{totalPending}</span>
							</div>
							<div className="h-2 bg-slate-200 rounded-full overflow-hidden">
								<div 
									className="h-full bg-brand-600 transition-all duration-300"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
						<p className="text-xs text-slate-500">You can add more photos while processing</p>
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
								{disabled ? disabledReason : "Upload roof photos for AI analysis"}
							</p>
							<p className="text-sm text-slate-500 mt-1">
								Drag & drop or click • Up to {maxFiles} photos • JPEG, PNG, WebP • Max 10MB each
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

			{/* Pending Photos Queue */}
			{pendingPhotos.length > 0 && (
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-slate-700">Upload Queue</h4>
					<div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
						{pendingPhotos.map((photo) => (
							<div
								key={photo.id}
								className="relative aspect-square rounded-lg overflow-hidden border border-slate-200"
							>
								<img
									src={photo.preview}
									alt="Pending"
									className="w-full h-full object-cover"
								/>
								{photo.status === "analyzing" && (
									<div className="absolute inset-0 bg-black/50 flex items-center justify-center">
										<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
									</div>
								)}
								{photo.status === "complete" && (
									<div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">
										<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									</div>
								)}
								{photo.status === "error" && (
									<div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
										<button
											onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
											className="text-white"
											title={photo.error}
										>
											<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								)}
							</div>
						))}
					</div>
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
