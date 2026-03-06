"use client";

import { useState, useCallback, useRef } from "react";
import type { ParsedCSVRow } from "@/lib/csv";

interface CSVUploadProps {
	onDataParsed: (data: ParsedCSVRow[]) => void;
	disabled?: boolean;
	disabledReason?: string;
}

export function CSVUpload({ onDataParsed, disabled, disabledReason }: CSVUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [fileName, setFileName] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		async (file: File) => {
			if (disabled) return;

			setIsLoading(true);
			setError(null);
			setWarnings([]);
			setFileName(file.name);

			try {
				const formData = new FormData();
				formData.append("file", file);

				const response = await fetch("/api/csv/upload", {
					method: "POST",
					body: formData
				});

				const result = await response.json();

				if (!response.ok) {
					setError(result.error || "Failed to upload CSV");
					if (result.details) {
						setWarnings(result.details);
					}
					return;
				}

				if (result.warnings?.length > 0) {
					setWarnings(result.warnings);
				}

				onDataParsed(result.data);
			} catch (err) {
				setError("Failed to process CSV file");
			} finally {
				setIsLoading(false);
			}
		},
		[disabled, onDataParsed]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);

			if (disabled) return;

			const file = e.dataTransfer.files[0];
			if (file) {
				handleFile(file);
			}
		},
		[disabled, handleFile]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleClick = useCallback(() => {
		if (!disabled) {
			fileInputRef.current?.click();
		}
	}, [disabled]);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFile(file);
			}
		},
		[handleFile]
	);

	const downloadTemplate = useCallback(() => {
		const template = [
			"Property Address,Roof Type,Shingle Type,Damage Notes,Insurance Company,Slopes Damaged,Customer Name,Claim Number,Inspection Date,Adjuster Name,Adjuster Email,Policy Number",
			'"123 Main St, Austin TX 78701",Asphalt Shingle,3-Tab,"Hail damage on north and east slopes. Multiple cracked and missing shingles.",State Farm,4,John Smith,CLM-2024-12345,2024-03-01,Jane Doe,jane.doe@statefarm.com,POL-987654'
		].join("\n");

		const blob = new Blob([template], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "stormclose-template.csv";
		a.click();
		URL.revokeObjectURL(url);
	}, []);

	return (
		<div className="space-y-4">
			<div
				className={`
					relative border-2 border-dashed rounded-xl p-8 text-center transition-all
					${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer hover:border-brand-500 hover:bg-brand-50/50"}
					${isDragging ? "border-brand-500 bg-brand-50" : "border-slate-300"}
					${error ? "border-red-300 bg-red-50" : ""}
				`}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onClick={handleClick}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept=".csv"
					onChange={handleFileChange}
					className="hidden"
					disabled={disabled}
				/>

				{isLoading ? (
					<div className="flex flex-col items-center gap-3">
						<div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
						<p className="text-slate-600">Processing {fileName}...</p>
					</div>
				) : (
					<div className="flex flex-col items-center gap-3">
						<div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
							<svg
								className="w-7 h-7 text-brand-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
								/>
							</svg>
						</div>
						<div>
							<p className="font-medium text-slate-900">
								{disabled ? disabledReason : "Drop your CSV file here"}
							</p>
							<p className="text-sm text-slate-500 mt-1">
								{disabled ? "" : "or click to browse • CSV format • Max 5MB"}
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

			{warnings.length > 0 && (
				<div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
					<p className="text-sm font-medium text-amber-800 mb-2">Warnings:</p>
					<ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
						{warnings.map((warning, i) => (
							<li key={i}>{warning}</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={downloadTemplate}
					className="text-sm text-brand-600 hover:text-brand-700 font-medium"
				>
					Download template CSV
				</button>
				<p className="text-xs text-slate-500">
					Supports JobNimbus & Xactimate formats
				</p>
			</div>
		</div>
	);
}
