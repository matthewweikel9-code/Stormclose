"use client";

import { useState, useRef, useEffect } from "react";
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
	
	// Imported roof measurement data
	const [importedRoofData, setImportedRoofData] = useState<{
		address: string;
		roofSquares: number;
		roofArea: number;
		pitch: string;
		facetCount: number;
		estimateLow: number;
		estimateHigh: number;
		materials: {
			shingleBundles: number;
			underlaymentRolls: number;
			ridgeCapBundles: number;
			dripEdgeFeet: number;
		};
	} | null>(null);
	
	// OCR Upload state
	const [isOcrProcessing, setIsOcrProcessing] = useState(false);
	const [ocrResult, setOcrResult] = useState<{
		lineItems: Array<{ code: string; description: string; quantity: string; unit: string; unitCost: string; total: string }>;
		summary: { subtotal: string; overhead: string; profit: string; total: string; rcv: string; depreciation: string; acv: string };
		claimInfo: { claimNumber: string; insured: string; dateOfLoss: string; carrier: string; adjuster: string };
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Load imported roof measurement data from sessionStorage
	useEffect(() => {
		const storedData = sessionStorage.getItem('roofMeasurementData');
		if (storedData) {
			try {
				const data = JSON.parse(storedData);
				setImportedRoofData(data);
				
				// Pre-fill roof type if we have data
				if (data.roofSquares) {
					setRoofType("Asphalt Shingle"); // Default based on measurements
				}
				
				// Create a pre-filled estimate based on roof measurements
				const avgCost = (data.estimateLow + data.estimateHigh) / 2;
				const laborCost = avgCost * 0.6;
				const materialCost = avgCost * 0.4;
				
				const prefilledEstimate = `ROOF REPLACEMENT ESTIMATE - ${data.address}

MEASUREMENTS:
- Total Roof Area: ${data.roofArea?.toLocaleString()} sq ft
- Roofing Squares: ${data.roofSquares}
- Pitch: ${data.pitch}
- Number of Facets: ${data.facetCount}

MATERIALS:
- Shingle Bundles: ${data.materials?.shingleBundles}
- Underlayment Rolls: ${data.materials?.underlaymentRolls}
- Ridge Cap Bundles: ${data.materials?.ridgeCapBundles}
- Drip Edge: ${data.materials?.dripEdgeFeet} linear ft

ESTIMATED COSTS:
- Labor: $${laborCost?.toLocaleString()}
- Materials: $${materialCost?.toLocaleString()}
- Total Estimate: $${avgCost?.toLocaleString()}

(Imported from Roof Measurement AI)`;

				setAdjusterEstimate(prefilledEstimate);
				
				// Clear the sessionStorage after loading
				sessionStorage.removeItem('roofMeasurementData');
			} catch (err) {
				console.error('Failed to parse roof measurement data:', err);
			}
		}
	}, []);

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
		if (!validTypes.includes(file.type)) {
			setError("Please upload an image (JPG, PNG) or PDF file");
			return;
		}

		setIsOcrProcessing(true);
		setError(null);
		setOcrResult(null);

		try {
			// Convert file to base64
			const reader = new FileReader();
			reader.onload = async () => {
				const base64 = reader.result as string;
				
				const response = await fetch("/api/estimate-ocr", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ imageBase64: base64 }),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "OCR processing failed");
				}

				setOcrResult(data.parsed);
				
				// Auto-populate the text area with extracted line items
				if (data.parsed?.lineItems) {
					const lineItemsText = data.parsed.lineItems
						.map((item: { code: string; description: string; quantity: string; unit: string; unitCost: string; total: string }) => 
							`${item.code}: ${item.description} - Qty: ${item.quantity} ${item.unit} @ ${item.unitCost} = ${item.total}`
						)
						.join("\n");
					
					setAdjusterEstimate(lineItemsText);
				}

				setIsOcrProcessing(false);
			};

			reader.readAsDataURL(file);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to process file");
			setIsOcrProcessing(false);
		}
	};

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
						{/* OCR Upload Section */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								Upload Estimate (Image/PDF)
							</label>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp,application/pdf"
								onChange={handleFileUpload}
								className="hidden"
							/>
							<button
								onClick={() => fileInputRef.current?.click()}
								disabled={isOcrProcessing}
								className="w-full rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/50 p-6 text-center hover:border-storm-purple hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isOcrProcessing ? (
									<div className="flex flex-col items-center gap-2">
										<svg className="animate-spin h-8 w-8 text-storm-glow" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
										</svg>
										<span className="text-storm-glow font-medium">Processing with AI OCR...</span>
									</div>
								) : (
									<div className="flex flex-col items-center gap-2">
										<svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span className="text-slate-300 font-medium">Click to upload estimate image</span>
										<span className="text-slate-500 text-sm">JPG, PNG, or PDF • AI will extract line items</span>
									</div>
								)}
							</button>
						</div>

						{/* OCR Results Preview */}
						{ocrResult && (
							<div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4">
								<div className="flex items-center gap-2 mb-2">
									<svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span className="font-medium text-emerald-400">Extracted {ocrResult.lineItems?.length || 0} line items</span>
								</div>
								{ocrResult.claimInfo?.claimNumber !== "N/A" && (
									<p className="text-sm text-slate-400">
										Claim: {ocrResult.claimInfo.claimNumber} • {ocrResult.claimInfo.carrier}
									</p>
								)}
							</div>
						)}

						{/* Imported Roof Data Banner */}
						{importedRoofData && (
							<div className="rounded-lg bg-storm-purple/10 border border-storm-purple/30 p-4">
								<div className="flex items-center gap-2 mb-2">
									<svg className="h-5 w-5 text-storm-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
									</svg>
									<span className="font-medium text-storm-glow">Imported from Roof Measurement AI</span>
								</div>
								<p className="text-sm text-slate-400">
									{importedRoofData.address} • {importedRoofData.roofSquares} squares • {importedRoofData.pitch} pitch
								</p>
							</div>
						)}

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-slate-700"></div>
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="bg-slate-900 px-4 text-slate-500">or paste text manually</span>
							</div>
						</div>

						{/* State Selection */}
						<div>
							<label className="block text-sm font-medium text-slate-400 mb-2">
								State <span className="text-red-400">*</span>
							</label>
							<select
								value={state}
								onChange={(e) => setState(e.target.value)}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
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
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
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
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
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
								className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
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
								className="w-full h-48 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-storm-purple focus:outline-none focus:ring-1 focus:ring-storm-purple"
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
			<Card className="p-6 bg-gradient-to-r from-storm-purple/5 to-storm-glow/5 border-storm-purple/20">
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
