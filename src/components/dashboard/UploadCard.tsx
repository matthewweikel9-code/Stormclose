"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";

interface UploadCardProps {
	onFileSelect: (file: File) => void;
	accept?: string;
	maxSize?: number; // in MB
	isLoading?: boolean;
}

export function UploadCard({
	onFileSelect,
	accept = ".csv",
	maxSize = 10,
	isLoading = false,
}: UploadCardProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleDrag = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDragIn = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragOut = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const validateAndSelectFile = useCallback(
		(file: File) => {
			setError(null);

			// Check file size
			if (file.size > maxSize * 1024 * 1024) {
				setError(`File size must be less than ${maxSize}MB`);
				return;
			}

			// Check file type
			const extension = file.name.split(".").pop()?.toLowerCase();
			const acceptedTypes = accept.split(",").map((t) => t.trim().replace(".", ""));
			if (!extension || !acceptedTypes.includes(extension)) {
				setError(`Please upload a ${accept} file`);
				return;
			}

			setSelectedFile(file);
			onFileSelect(file);
		},
		[accept, maxSize, onFileSelect]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const files = e.dataTransfer.files;
			if (files && files.length > 0) {
				validateAndSelectFile(files[0]);
			}
		},
		[validateAndSelectFile]
	);

	const handleFileInput = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				validateAndSelectFile(files[0]);
			}
		},
		[validateAndSelectFile]
	);

	return (
		<motion.div
			whileHover={{ scale: isLoading ? 1 : 1.01 }}
			className={`relative rounded-xl border-2 border-dashed p-8 transition-all ${
				isDragging
					? "border-storm-purple bg-storm-purple/10"
					: "border-storm-border bg-storm-z1 hover:border-storm-purple/50"
			}`}
			onDragEnter={handleDragIn}
			onDragLeave={handleDragOut}
			onDragOver={handleDrag}
			onDrop={handleDrop}
		>
			<input
				type="file"
				accept={accept}
				onChange={handleFileInput}
				className="absolute inset-0 cursor-pointer opacity-0"
				disabled={isLoading}
			/>

			<div className="flex flex-col items-center justify-center text-center">
				{/* Icon */}
				<div
					className={`mb-4 rounded-xl p-4 ${
						isDragging ? "bg-storm-purple/20" : "bg-storm-z2"
					}`}
				>
					<svg
						className={`h-8 w-8 ${
							isDragging ? "text-storm-purple" : "text-storm-glow"
						}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
						/>
					</svg>
				</div>

				{/* Text */}
				{selectedFile ? (
					<div>
						<p className="text-lg font-semibold text-white">
							{selectedFile.name}
						</p>
						<p className="mt-1 text-sm text-slate-400">
							{(selectedFile.size / 1024).toFixed(1)} KB
						</p>
					</div>
				) : (
					<div>
						<p className="text-lg font-semibold text-white">
							{isDragging ? "Drop your file here" : "Drag and drop your CSV"}
						</p>
						<p className="mt-1 text-sm text-slate-400">
							or click to browse • Max {maxSize}MB
						</p>
					</div>
				)}

				{/* Error */}
				{error && (
					<p className="mt-3 text-sm font-medium text-red-400">{error}</p>
				)}

				{/* Loading indicator */}
				{isLoading && (
					<div className="mt-4 flex items-center gap-2 text-storm-glow">
						<svg
							className="h-5 w-5 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						<span className="text-sm font-medium">Processing...</span>
					</div>
				)}
			</div>
		</motion.div>
	);
}
