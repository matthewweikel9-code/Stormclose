"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, Card } from "@/components/dashboard";
import { Button } from "@/components/dashboard/Button";

const US_STATES = [
	"Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
	"Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
	"Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
	"Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
	"New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
	"Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
	"Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
	"Wisconsin", "Wyoming"
];

const DAMAGE_TYPES = [
	"Hail Damage",
	"Wind Damage", 
	"Storm Damage",
	"Water Damage",
	"Fire Damage",
	"Tree Impact",
	"Mixed Damage"
];

const ROOF_TYPES = [
	"Asphalt Shingle",
	"Metal",
	"Tile",
	"Slate",
	"Wood Shake",
	"Flat/TPO",
	"EPDM"
];

export default function SupplementGeneratorPage() {
	const [adjusterEstimate, setAdjusterEstimate] = useState("");
	const [damageType, setDamageType] = useState("");
	const [state, setState] = useState("");
	const [roofType, setRoofType] = useState("");
	const [propertyAge, setPropertyAge] = useState("");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleAnalyze = async () => {
		if (!adjusterEstimate || !damageType || !state) {
			setError("Please fill in all required fields");
			return;
		}

		setIsAnalyzing(true);
		setError(null);
		setResult(null);
		
		try {
			const response = await fetch("/api/supplements", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					adjusterEstimate,
					damageType,
					state,
					roofType: roofType || undefined,
					propertyAge: propertyAge || undefined,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to analyze");
			}

			setResult(data.supplement);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to generate supplement");
		} finally {
			setIsAnalyzing(false);
		}
	};

	const copyToClipboard = () => {
		if (result) {
			navigator.clipboard.writeText(result);
		}
	};

	return (
		<div className="mx-auto max-w-6xl space-y-8">
			<PageHeader
				kicker="Enterprise Feature"
				title="Automated Supplement Generation"
				description="AI analyzes adjuster estimates to find missing Xactimate line items and generates supplement requests."
			/>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Input Section */}
				<Card className="p-6">
					<h3 className="text-lg font-semibold text-white mb-4">
						Upload Adjuster Estimate
					</h3>
					
					<div className="space-y-4">
						{/* State Selection */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								State <span className="text-red-400">*</span>
							</label>
							<select
								value={state}
								onChange={(e) => setState(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
							>
								<option value="">Select state...</option>
								{US_STATES.map((s) => (
									<option key={s} value={s}>{s}</option>
								))}
							</select>
						</div>

						{/* Damage Type */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Damage Type <span className="text-red-400">*</span>
							</label>
							<select
								value={damageType}
								onChange={(e) => setDamageType(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
							>
								<option value="">Select damage type...</option>
								{DAMAGE_TYPES.map((d) => (
									<option key={d} value={d}>{d}</option>
								))}
							</select>
						</div>

						{/* Roof Type (Optional) */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Roof Type (Optional)
							</label>
							<select
								value={roofType}
								onChange={(e) => setRoofType(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
							>
								<option value="">Select roof type...</option>
								{ROOF_TYPES.map((r) => (
									<option key={r} value={r}>{r}</option>
								))}
							</select>
						</div>

						{/* Property Age */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Property Age in Years (Optional)
							</label>
							<input
								type="number"
								value={propertyAge}
								onChange={(e) => setPropertyAge(e.target.value)}
								placeholder="e.g., 15"
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
							/>
						</div>

						{/* Estimate Text */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Paste Adjuster&apos;s Estimate <span className="text-red-400">*</span>
							</label>
							<textarea
								value={adjusterEstimate}
								onChange={(e) => setAdjusterEstimate(e.target.value)}
								placeholder="Paste the adjuster's estimate text here, including all line items, quantities, and pricing..."
								className="w-full h-48 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-[#6D5CFF] focus:outline-none focus:ring-1 focus:ring-[#6D5CFF]"
							/>
						</div>

						{error && (
							<div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<Button
							onClick={handleAnalyze}
							disabled={!adjusterEstimate || !damageType || !state || isAnalyzing}
							variant="primary"
							className="w-full"
							glow
						>
							{isAnalyzing ? (
								<span className="flex items-center justify-center gap-2">
									<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									Analyzing Estimate...
								</span>
							) : (
								"Generate Supplement Request"
							)}
						</Button>
					</div>
				</Card>

				{/* Results Section */}
				<Card className="p-6">
					<h3 className="text-lg font-semibold text-white mb-4">
						Supplement Analysis
					</h3>

					{!result ? (
						<div className="flex flex-col items-center justify-center h-64 text-slate-500">
							<svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
							</svg>
							<p className="text-center">
								Upload an adjuster estimate to find<br />missing Xactimate line items
							</p>
						</div>
					) : (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="space-y-4"
						>
							{/* Result Display */}
							<div className="rounded-lg bg-slate-800 p-4 max-h-[500px] overflow-y-auto">
								<pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
									{result}
								</pre>
							</div>

							{/* Actions */}
							<div className="flex gap-3 pt-4 border-t border-slate-700">
								<Button variant="primary" className="flex-1" onClick={copyToClipboard}>
									Copy to Clipboard
								</Button>
								<Button variant="secondary" className="flex-1" onClick={() => setResult(null)}>
									Start Over
								</Button>
							</div>
						</motion.div>
					)}
				</Card>
			</div>

			{/* Tips Card */}
			<Card className="p-6 bg-gradient-to-r from-[#6D5CFF]/5 to-[#A78BFA]/5 border-[#6D5CFF]/20">
				<h3 className="text-lg font-semibold text-white mb-3">💡 Supplement Tips</h3>
				<ul className="grid md:grid-cols-2 gap-3 text-sm text-slate-400">
					<li className="flex items-start gap-2">
						<span className="text-emerald-400">✓</span>
						Always include photos showing damage that justifies each line item
					</li>
					<li className="flex items-start gap-2">
						<span className="text-emerald-400">✓</span>
						Reference the specific Xactimate code in your supplement request
					</li>
					<li className="flex items-start gap-2">
						<span className="text-emerald-400">✓</span>
						Submit supplements within 30 days of initial estimate
					</li>
					<li className="flex items-start gap-2">
						<span className="text-emerald-400">✓</span>
						Track which adjusters approve supplements for future reference
					</li>
				</ul>
			</Card>
		</div>
	);
}
