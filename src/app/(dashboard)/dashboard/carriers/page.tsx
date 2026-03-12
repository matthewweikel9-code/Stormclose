"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";

interface CarrierSummary {
	id: string;
	name: string;
	approvalRate: number;
	avgClaimValue: number;
	supplementSuccessRate: number;
}

interface CarrierDetails {
	name: string;
	approvalRate: number;
	avgClaimValue: number;
	commonDenials: string[];
	supplementSuccessRate: number;
	avgResponseTime: string;
	negotiationTips: string[];
	preferredDocumentation: string[];
}

export default function CarrierIntelligencePage() {
	const [carriers, setCarriers] = useState<CarrierSummary[]>([]);
	const [selectedCarrier, setSelectedCarrier] = useState<CarrierDetails | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingDetails, setIsLoadingDetails] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchCarriers();
	}, []);

	const fetchCarriers = async () => {
		try {
			const response = await fetch("/api/carriers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to load carriers");
			}

			setCarriers(data.carriers || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load carrier data");
		} finally {
			setIsLoading(false);
		}
	};

	const fetchCarrierDetails = async (carrierId: string) => {
		setIsLoadingDetails(true);
		try {
			const response = await fetch("/api/carriers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ carrier: carrierId }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to load carrier details");
			}

			setSelectedCarrier(data.carrier);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load carrier details");
		} finally {
			setIsLoadingDetails(false);
		}
	};

	const getApprovalRateColor = (rate: number) => {
		if (rate >= 75) return "text-emerald-400";
		if (rate >= 60) return "text-amber-400";
		return "text-red-400";
	};

	const getApprovalRateBg = (rate: number) => {
		if (rate >= 75) return "bg-emerald-400";
		if (rate >= 60) return "bg-amber-400";
		return "bg-red-400";
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<PageHeader
				kicker="Pro Feature"
				title="Insurance Carrier Intelligence"
				description="Know your opponent. Access approval rates, denial patterns, and negotiation strategies for every major carrier."
			/>

			{error && (
				<div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
					{error}
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Carrier List */}
				<Card className="p-6 lg:col-span-1">
					<h3 className="text-lg font-semibold text-white mb-4">
						Select Carrier
					</h3>

					{isLoading ? (
						<div className="space-y-3">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
							))}
						</div>
					) : (
						<div className="space-y-2">
							{carriers.map((carrier) => (
								<button
									key={carrier.id}
									onClick={() => fetchCarrierDetails(carrier.id)}
									className={`w-full text-left p-4 rounded-lg transition-all ${
										selectedCarrier?.name === carrier.name
											? "bg-storm-purple/20 border border-storm-purple/50"
											: "bg-slate-800 hover:bg-slate-700 border border-transparent"
									}`}
								>
									<div className="flex justify-between items-center">
										<span className="font-medium text-white">{carrier.name}</span>
										<span className={`text-sm font-semibold ${getApprovalRateColor(carrier.approvalRate)}`}>
											{carrier.approvalRate}%
										</span>
									</div>
									<div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
										<div
											className={`h-full rounded-full ${getApprovalRateBg(carrier.approvalRate)}`}
											style={{ width: `${carrier.approvalRate}%` }}
										/>
									</div>
								</button>
							))}
						</div>
					)}
				</Card>

				{/* Carrier Details */}
				<Card className="p-6 lg:col-span-2">
					{isLoadingDetails ? (
						<div className="flex items-center justify-center h-64">
							<div className="animate-spin h-8 w-8 border-2 border-storm-purple border-t-transparent rounded-full" />
						</div>
					) : !selectedCarrier ? (
						<div className="flex flex-col items-center justify-center h-64 text-slate-500">
							<svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
							</svg>
							<p className="text-center">
								Select a carrier to view<br />detailed intelligence
							</p>
						</div>
					) : (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="space-y-6"
						>
							{/* Header */}
							<div className="flex items-center justify-between">
								<h3 className="text-xl font-bold text-white">{selectedCarrier.name}</h3>
								<span className="text-sm text-slate-400">
									Avg Response: {selectedCarrier.avgResponseTime}
								</span>
							</div>

							{/* Stats Grid */}
							<div className="grid grid-cols-3 gap-4">
								<div className="rounded-lg bg-slate-800 p-4 text-center">
									<p className="text-sm text-slate-400">Approval Rate</p>
									<p className={`text-2xl font-bold ${getApprovalRateColor(selectedCarrier.approvalRate)}`}>
										{selectedCarrier.approvalRate}%
									</p>
								</div>
								<div className="rounded-lg bg-slate-800 p-4 text-center">
									<p className="text-sm text-slate-400">Avg Claim Value</p>
									<p className="text-2xl font-bold text-white">
										${selectedCarrier.avgClaimValue.toLocaleString()}
									</p>
								</div>
								<div className="rounded-lg bg-slate-800 p-4 text-center">
									<p className="text-sm text-slate-400">Supplement Success</p>
									<p className={`text-2xl font-bold ${getApprovalRateColor(selectedCarrier.supplementSuccessRate)}`}>
										{selectedCarrier.supplementSuccessRate}%
									</p>
								</div>
							</div>

							{/* Common Denials */}
							<div>
								<h4 className="text-sm font-semibold text-white mb-3">⚠️ Common Denial Reasons</h4>
								<div className="space-y-2">
									{selectedCarrier.commonDenials.map((denial, i) => (
										<div key={i} className="flex items-center gap-2 text-sm">
											<span className="text-red-400">•</span>
											<span className="text-slate-300">{denial}</span>
										</div>
									))}
								</div>
							</div>

							{/* Negotiation Tips */}
							<div>
								<h4 className="text-sm font-semibold text-white mb-3">💡 Negotiation Tips</h4>
								<div className="space-y-2">
									{selectedCarrier.negotiationTips.map((tip, i) => (
										<div key={i} className="flex items-start gap-2 text-sm">
											<span className="text-emerald-400 mt-0.5">✓</span>
											<span className="text-slate-300">{tip}</span>
										</div>
									))}
								</div>
							</div>

							{/* Preferred Documentation */}
							<div>
								<h4 className="text-sm font-semibold text-white mb-3">📄 Preferred Documentation</h4>
								<div className="flex flex-wrap gap-2">
									{selectedCarrier.preferredDocumentation.map((doc, i) => (
										<span
											key={i}
											className="px-3 py-1 rounded-full bg-storm-purple/20 text-storm-glow text-xs"
										>
											{doc}
										</span>
									))}
								</div>
							</div>
						</motion.div>
					)}
				</Card>
			</div>

			{/* Pro Tip Card */}
			<Card className="p-6 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
				<h3 className="text-lg font-semibold text-white mb-3">🎯 Pro Strategy</h3>
				<p className="text-sm text-slate-400">
					Carriers with approval rates under 70% often have stricter documentation requirements. 
					Focus on gathering comprehensive photo evidence and third-party reports before submitting claims to these carriers.
					Use our Supplement Generator to ensure you don&apos;t miss any line items.
				</p>
			</Card>
		</div>
	);
}
