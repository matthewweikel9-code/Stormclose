"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";

interface Lead {
	id: string;
	name: string;
	address: string;
	damageType: string;
	carrier: string;
	claimValue: string;
	source: string;
	notes: string;
}

interface ScoredLead {
	id: string;
	name: string;
	score: number;
	closeProb: number;
	priority: "high" | "medium" | "low";
	reasoning: string;
	nextAction: string;
}

interface ScoringResult {
	leads: ScoredLead[];
	summary: {
		total: number;
		highPriority: number;
		mediumPriority: number;
		lowPriority: number;
		avgScore: number;
	};
}

const DAMAGE_TYPES = [
	"Hail Damage", "Wind Damage", "Storm Damage", "Water Damage", "Fire Damage", "Tree Impact", "Mixed Damage"
];

const CARRIERS = [
	"State Farm", "Allstate", "Liberty Mutual", "USAA", "Farmers", "Progressive", "Nationwide", "Travelers", "Unknown"
];

const SOURCES = [
	"Door Knock", "Referral", "Google Ads", "Facebook", "Website", "Yard Sign", "Other"
];

export default function LeadScoringPage() {
	const [leads, setLeads] = useState<Lead[]>([
		{ id: "1", name: "", address: "", damageType: "", carrier: "", claimValue: "", source: "", notes: "" }
	]);
	const [result, setResult] = useState<ScoringResult | null>(null);
	const [isScoring, setIsScoring] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const addLead = () => {
		setLeads([
			...leads,
			{ id: String(leads.length + 1), name: "", address: "", damageType: "", carrier: "", claimValue: "", source: "", notes: "" }
		]);
	};

	const removeLead = (index: number) => {
		if (leads.length > 1) {
			setLeads(leads.filter((_, i) => i !== index));
		}
	};

	const updateLead = (index: number, field: keyof Lead, value: string) => {
		const updated = [...leads];
		updated[index] = { ...updated[index], [field]: value };
		setLeads(updated);
	};

	const handleScore = async () => {
		const validLeads = leads.filter(l => l.name.trim());
		if (validLeads.length === 0) {
			setError("Please add at least one lead with a name");
			return;
		}

		setIsScoring(true);
		setError(null);
		setResult(null);

		try {
			const response = await fetch("/api/leads", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					leads: validLeads.map(l => ({
						id: l.id,
						name: l.name,
						address: l.address || undefined,
						damageType: l.damageType || undefined,
						carrier: l.carrier || undefined,
						claimValue: l.claimValue ? parseInt(l.claimValue) : undefined,
						source: l.source || undefined,
						notes: l.notes || undefined,
					})),
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to score leads");
			}

			setResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to score leads");
		} finally {
			setIsScoring(false);
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high": return "text-emerald-400 bg-emerald-500/20";
			case "medium": return "text-amber-400 bg-amber-500/20";
			case "low": return "text-red-400 bg-red-500/20";
			default: return "text-slate-400 bg-slate-500/20";
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<PageHeader
				kicker="Pro Feature"
				title="Predictive Lead Scoring"
				description="AI analyzes your leads to predict close probability. Focus on the opportunities most likely to convert."
			/>

			{!result ? (
				<>
					{/* Lead Input */}
					<Card className="p-6">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold text-white">Enter Your Leads</h3>
							<Button variant="secondary" onClick={addLead}>
								+ Add Lead
							</Button>
						</div>

						<div className="space-y-4">
							{leads.map((lead, index) => (
								<div key={lead.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700">
									<div className="flex justify-between items-center mb-3">
										<span className="text-sm font-medium text-slate-400">Lead #{index + 1}</span>
										{leads.length > 1 && (
											<button
												onClick={() => removeLead(index)}
												className="text-xs text-red-400 hover:text-red-300"
											>
												Remove
											</button>
										)}
									</div>

									<div className="grid md:grid-cols-3 gap-3">
										<input
											type="text"
											placeholder="Name *"
											value={lead.name}
											onChange={(e) => updateLead(index, "name", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
										/>
										<input
											type="text"
											placeholder="Address"
											value={lead.address}
											onChange={(e) => updateLead(index, "address", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
										/>
										<select
											value={lead.damageType}
											onChange={(e) => updateLead(index, "damageType", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-[#6D5CFF] focus:outline-none"
										>
											<option value="">Damage Type</option>
											{DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
										</select>
										<select
											value={lead.carrier}
											onChange={(e) => updateLead(index, "carrier", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-[#6D5CFF] focus:outline-none"
										>
											<option value="">Insurance Carrier</option>
											{CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
										</select>
										<input
											type="number"
											placeholder="Est. Claim Value ($)"
											value={lead.claimValue}
											onChange={(e) => updateLead(index, "claimValue", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
										/>
										<select
											value={lead.source}
											onChange={(e) => updateLead(index, "source", e.target.value)}
											className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-[#6D5CFF] focus:outline-none"
										>
											<option value="">Lead Source</option>
											{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
										</select>
									</div>

									<input
										type="text"
										placeholder="Notes (optional)"
										value={lead.notes}
										onChange={(e) => updateLead(index, "notes", e.target.value)}
										className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none"
									/>
								</div>
							))}
						</div>

						{error && (
							<div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<Button
							onClick={handleScore}
							disabled={isScoring || leads.every(l => !l.name.trim())}
							variant="primary"
							className="w-full mt-6"
							glow
						>
							{isScoring ? (
								<span className="flex items-center justify-center gap-2">
									<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									Scoring Leads...
								</span>
							) : (
								"Score My Leads"
							)}
						</Button>
					</Card>
				</>
			) : (
				<>
					{/* Results */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="space-y-6"
					>
						{/* Summary Stats */}
						<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
							<Card className="p-4 text-center">
								<p className="text-sm text-slate-400">Total Leads</p>
								<p className="text-2xl font-bold text-white">{result.summary.total}</p>
							</Card>
							<Card className="p-4 text-center">
								<p className="text-sm text-slate-400">Avg Score</p>
								<p className="text-2xl font-bold text-[#A78BFA]">{result.summary.avgScore}</p>
							</Card>
							<Card className="p-4 text-center bg-emerald-500/10 border-emerald-500/20">
								<p className="text-sm text-slate-400">High Priority</p>
								<p className="text-2xl font-bold text-emerald-400">{result.summary.highPriority}</p>
							</Card>
							<Card className="p-4 text-center bg-amber-500/10 border-amber-500/20">
								<p className="text-sm text-slate-400">Medium Priority</p>
								<p className="text-2xl font-bold text-amber-400">{result.summary.mediumPriority}</p>
							</Card>
							<Card className="p-4 text-center bg-red-500/10 border-red-500/20">
								<p className="text-sm text-slate-400">Low Priority</p>
								<p className="text-2xl font-bold text-red-400">{result.summary.lowPriority}</p>
							</Card>
						</div>

						{/* Scored Leads */}
						<Card className="p-6">
							<div className="flex justify-between items-center mb-4">
								<h3 className="text-lg font-semibold text-white">Prioritized Leads</h3>
								<Button variant="secondary" onClick={() => setResult(null)}>
									Score New Leads
								</Button>
							</div>

							<div className="space-y-3">
								{result.leads.map((lead, index) => (
									<motion.div
										key={lead.id}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.05 }}
										className="p-4 rounded-lg bg-slate-800 border border-slate-700"
									>
										<div className="flex justify-between items-start">
											<div className="flex items-center gap-3">
												<div className="text-center">
													<div className="text-2xl font-bold text-white">{lead.score}</div>
													<div className="text-xs text-slate-500">Score</div>
												</div>
												<div className="h-12 w-px bg-slate-700" />
												<div>
													<p className="font-medium text-white">{lead.name}</p>
													<p className="text-sm text-slate-400">{lead.closeProb}% close probability</p>
												</div>
											</div>
											<span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(lead.priority)}`}>
												{lead.priority.toUpperCase()}
											</span>
										</div>
										
										<div className="mt-3 pt-3 border-t border-slate-700 grid md:grid-cols-2 gap-3">
											<div>
												<p className="text-xs text-slate-500 mb-1">Why This Score</p>
												<p className="text-sm text-slate-300">{lead.reasoning}</p>
											</div>
											<div>
												<p className="text-xs text-slate-500 mb-1">Recommended Action</p>
												<p className="text-sm text-[#A78BFA]">{lead.nextAction}</p>
											</div>
										</div>
									</motion.div>
								))}
							</div>
						</Card>
					</motion.div>
				</>
			)}
		</div>
	);
}
