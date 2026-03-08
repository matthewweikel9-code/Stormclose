"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";

interface RoofSegment {
	id: number;
	areaSqFt: number;
	pitchDegrees: number;
	pitchRatio: string;
	azimuthDegrees: number;
	direction: string;
	pitchMultiplier: number;
}

interface MeasurementResult {
	success: boolean;
	address: string;
	coordinates: { lat: number; lng: number };
	measurements: {
		totalAreaSqFt: number;
		totalSquares: number;
		groundAreaSqFt: number;
		facetCount: number;
		avgPitchDegrees: number;
		avgPitchRatio: string;
	};
	segments: RoofSegment[];
	estimates: {
		shingleBundles: number;
		underlaymentRolls: number;
		ridgeCapBundles: number;
		dripEdgeFeet: number;
		costRange: {
			low: number;
			high: number;
		};
	};
	imageryDate: string;
	dataQuality: string;
}

export default function RoofMeasurementPage() {
	const [address, setAddress] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<MeasurementResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleMeasure = async () => {
		if (!address.trim()) return;

		setIsLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await fetch("/api/roof-measurement", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to get measurements");
			}

			setResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<PageHeader
				kicker="Enterprise Feature"
				title="Instant Roof Measurement AI"
				description="Get accurate roof measurements from satellite imagery in seconds. No ladder, no drone, no site visit."
			/>

			{/* Search Input */}
			<Card className="p-6">
				<div className="flex flex-col gap-4 sm:flex-row">
					<div className="flex-1">
						<label className="mb-2 block text-sm font-medium text-slate-300">
							Property Address
						</label>
						<input
							type="text"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleMeasure()}
							placeholder="Enter full address (e.g., 123 Main St, Dallas, TX 75201)"
							className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
						/>
					</div>
					<div className="flex items-end">
						<Button
							onClick={handleMeasure}
							variant="primary"
							disabled={isLoading || !address.trim()}
							className="w-full sm:w-auto px-8 py-3"
						>
							{isLoading ? (
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									Measuring...
								</span>
							) : (
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
									</svg>
									Get Measurements
								</span>
							)}
						</Button>
					</div>
				</div>
			</Card>

			{/* Error State */}
			{error && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
				>
					<p className="text-red-400">{error}</p>
				</motion.div>
			)}

			{/* Results */}
			{result && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="space-y-6"
				>
					{/* Address & Overview */}
					<Card className="p-6">
						<div className="flex items-start justify-between">
							<div>
								<h3 className="text-lg font-semibold text-white">{result.address}</h3>
								<p className="mt-1 text-sm text-slate-400">
									Imagery Date: {result.imageryDate} • Quality: {result.dataQuality}
								</p>
							</div>
							<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
								✓ Measurements Complete
							</span>
						</div>
					</Card>

					{/* Key Metrics */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Card className="p-5 text-center">
							<p className="text-4xl font-bold text-white">{result.measurements.totalSquares}</p>
							<p className="mt-1 text-sm text-slate-400">Roofing Squares</p>
						</Card>
						<Card className="p-5 text-center">
							<p className="text-4xl font-bold text-[#A78BFA]">{result.measurements.totalAreaSqFt.toLocaleString()}</p>
							<p className="mt-1 text-sm text-slate-400">Total Sq Ft</p>
						</Card>
						<Card className="p-5 text-center">
							<p className="text-4xl font-bold text-amber-400">{result.measurements.avgPitchRatio}</p>
							<p className="mt-1 text-sm text-slate-400">Average Pitch</p>
						</Card>
						<Card className="p-5 text-center">
							<p className="text-4xl font-bold text-emerald-400">{result.measurements.facetCount}</p>
							<p className="mt-1 text-sm text-slate-400">Roof Facets</p>
						</Card>
					</div>

					{/* Two Column Layout */}
					<div className="grid gap-6 lg:grid-cols-2">
						{/* Roof Segments */}
						<Card className="p-6">
							<h3 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
								<svg className="h-5 w-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
								</svg>
								Roof Segments
							</h3>
							<div className="space-y-3 max-h-64 overflow-y-auto">
								{result.segments.map((segment) => (
									<div
										key={segment.id}
										className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3"
									>
										<div>
											<p className="font-medium text-white">
												Facet {segment.id} - {segment.direction}
											</p>
											<p className="text-sm text-slate-400">
												{segment.pitchRatio} pitch • {segment.pitchDegrees}°
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-white">{segment.areaSqFt.toLocaleString()} sq ft</p>
											<p className="text-xs text-slate-500">{segment.azimuthDegrees}° azimuth</p>
										</div>
									</div>
								))}
							</div>
						</Card>

						{/* Material Estimates */}
						<Card className="p-6">
							<h3 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
								<svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
								</svg>
								Material Estimates
							</h3>
							<div className="space-y-3">
								<div className="flex justify-between rounded-lg bg-slate-800/50 p-3">
									<span className="text-slate-300">Shingle Bundles (3-tab)</span>
									<span className="font-semibold text-white">{result.estimates.shingleBundles}</span>
								</div>
								<div className="flex justify-between rounded-lg bg-slate-800/50 p-3">
									<span className="text-slate-300">Underlayment Rolls</span>
									<span className="font-semibold text-white">{result.estimates.underlaymentRolls}</span>
								</div>
								<div className="flex justify-between rounded-lg bg-slate-800/50 p-3">
									<span className="text-slate-300">Ridge Cap Bundles</span>
									<span className="font-semibold text-white">{result.estimates.ridgeCapBundles}</span>
								</div>
								<div className="flex justify-between rounded-lg bg-slate-800/50 p-3">
									<span className="text-slate-300">Drip Edge (linear ft)</span>
									<span className="font-semibold text-white">{result.estimates.dripEdgeFeet}</span>
								</div>
							</div>
						</Card>
					</div>

					{/* Cost Estimate */}
					<Card className="p-6 bg-gradient-to-br from-[#6D5CFF]/10 to-transparent border-[#6D5CFF]/30">
						<h3 className="mb-4 text-lg font-semibold text-white flex items-center gap-2">
							<svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							Estimated Project Cost
						</h3>
						<div className="flex items-center justify-center gap-4">
							<div className="text-center">
								<p className="text-3xl font-bold text-white">
									{formatCurrency(result.estimates.costRange.low)} - {formatCurrency(result.estimates.costRange.high)}
								</p>
								<p className="mt-1 text-sm text-slate-400">
									Based on {result.measurements.totalSquares} squares at {result.measurements.avgPitchRatio} pitch
								</p>
							</div>
						</div>
						<p className="mt-4 text-center text-xs text-slate-500">
							* Estimates include materials and labor. Actual costs may vary based on location, material choice, and complexity.
						</p>
					</Card>

					{/* Actions */}
					<div className="flex flex-wrap gap-4 justify-center">
						<Button variant="secondary" className="flex items-center gap-2">
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
							</svg>
							Download Report (PDF)
						</Button>
						<Button variant="secondary" className="flex items-center gap-2">
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							Create Estimate
						</Button>
						<Button variant="secondary" className="flex items-center gap-2">
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Generate Supplement
						</Button>
					</div>
				</motion.div>
			)}

			{/* Empty State */}
			{!result && !error && !isLoading && (
				<Card className="p-12 text-center">
					<div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#6D5CFF]/10 flex items-center justify-center">
						<svg className="h-8 w-8 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
						</svg>
					</div>
					<h3 className="text-lg font-semibold text-white">Enter an address to get started</h3>
					<p className="mt-2 text-slate-400 max-w-md mx-auto">
						Our AI will analyze satellite imagery to provide instant roof measurements, 
						material estimates, and cost projections — no site visit required.
					</p>
					<div className="mt-6 flex flex-wrap gap-3 justify-center text-sm text-slate-500">
						<span className="flex items-center gap-1">
							<svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							Accurate measurements
						</span>
						<span className="flex items-center gap-1">
							<svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							Instant results
						</span>
						<span className="flex items-center gap-1">
							<svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
							</svg>
							Material estimates
						</span>
					</div>
				</Card>
			)}
		</div>
	);
}
