"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export type PipelineStage = 
	| "leads"
	| "inspected"
	| "claim_filed"
	| "approved"
	| "scheduled"
	| "completed";

export interface PipelineDeal {
	id: string;
	customerName: string;
	address: string;
	stage: PipelineStage;
	estimatedValue: number;
	daysInStage: number;
	insuranceCompany?: string;
	lastActivity?: string;
}

interface PipelineProps {
	deals?: PipelineDeal[];
	onDealClick?: (deal: PipelineDeal) => void;
	onStageChange?: (dealId: string, newStage: PipelineStage) => void;
}

const STAGES: { key: PipelineStage; label: string; color: string; bgColor: string }[] = [
	{ key: "leads", label: "Leads", color: "text-slate-400", bgColor: "bg-slate-500/20" },
	{ key: "inspected", label: "Inspected", color: "text-blue-400", bgColor: "bg-blue-500/20" },
	{ key: "claim_filed", label: "Claim Filed", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
	{ key: "approved", label: "Approved", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
	{ key: "scheduled", label: "Scheduled", color: "text-purple-400", bgColor: "bg-purple-500/20" },
	{ key: "completed", label: "Completed", color: "text-green-400", bgColor: "bg-green-500/20" }
];

// Demo data - in production this would come from the database
const DEMO_DEALS: PipelineDeal[] = [
	{ id: "1", customerName: "Johnson Family", address: "123 Oak Lane", stage: "leads", estimatedValue: 12500, daysInStage: 2, lastActivity: "Initial contact" },
	{ id: "2", customerName: "Sarah Mitchell", address: "456 Maple Dr", stage: "leads", estimatedValue: 18000, daysInStage: 5, lastActivity: "Left voicemail" },
	{ id: "3", customerName: "Williams Residence", address: "789 Cedar St", stage: "inspected", estimatedValue: 22000, daysInStage: 3, insuranceCompany: "State Farm", lastActivity: "Photos uploaded" },
	{ id: "4", customerName: "Thompson Home", address: "321 Pine Ave", stage: "inspected", estimatedValue: 15500, daysInStage: 1, insuranceCompany: "Allstate", lastActivity: "Report sent" },
	{ id: "5", customerName: "Garcia Property", address: "654 Birch Rd", stage: "claim_filed", estimatedValue: 28000, daysInStage: 7, insuranceCompany: "USAA", lastActivity: "Waiting on adjuster" },
	{ id: "6", customerName: "Anderson House", address: "987 Elm Way", stage: "claim_filed", estimatedValue: 16000, daysInStage: 4, insuranceCompany: "Farmers", lastActivity: "Adjuster scheduled" },
	{ id: "7", customerName: "Davis Residence", address: "147 Spruce Ln", stage: "approved", estimatedValue: 24500, daysInStage: 2, insuranceCompany: "Liberty Mutual", lastActivity: "Supplement approved" },
	{ id: "8", customerName: "Martinez Home", address: "258 Willow Ct", stage: "scheduled", estimatedValue: 19000, daysInStage: 1, insuranceCompany: "State Farm", lastActivity: "Install date: Mar 15" },
	{ id: "9", customerName: "Brown Family", address: "369 Ash Blvd", stage: "scheduled", estimatedValue: 21000, daysInStage: 3, insuranceCompany: "Nationwide", lastActivity: "Materials ordered" },
	{ id: "10", customerName: "Taylor Property", address: "741 Hickory Dr", stage: "completed", estimatedValue: 17500, daysInStage: 0, insuranceCompany: "Allstate", lastActivity: "Final inspection passed" },
];

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function Pipeline({ deals = DEMO_DEALS, onDealClick, onStageChange }: PipelineProps) {
	const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
	const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

	const getDealsByStage = (stage: PipelineStage) => 
		deals.filter(d => d.stage === stage);

	const getStageValue = (stage: PipelineStage) =>
		getDealsByStage(stage).reduce((sum, d) => sum + d.estimatedValue, 0);

	const getTotalPipelineValue = () =>
		deals.filter(d => d.stage !== "completed").reduce((sum, d) => sum + d.estimatedValue, 0);

	const handleDragStart = (e: React.DragEvent, dealId: string) => {
		setDraggedDeal(dealId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e: React.DragEvent, stage: PipelineStage) => {
		e.preventDefault();
		if (draggedDeal && onStageChange) {
			onStageChange(draggedDeal, stage);
		}
		setDraggedDeal(null);
	};

	return (
		<div className="space-y-6">
			{/* Pipeline Summary */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-white">Sales Pipeline</h2>
					<p className="text-sm text-slate-400">
						{deals.filter(d => d.stage !== "completed").length} active deals • {formatCurrency(getTotalPipelineValue())} potential
					</p>
				</div>
				<div className="flex items-center gap-4 text-sm">
					<div className="flex items-center gap-2">
						<div className="h-3 w-3 rounded-full bg-emerald-500" />
						<span className="text-slate-400">Completed this month:</span>
						<span className="font-semibold text-emerald-400">
							{formatCurrency(getDealsByStage("completed").reduce((sum, d) => sum + d.estimatedValue, 0))}
						</span>
					</div>
				</div>
			</div>

			{/* Stage Headers with Values */}
			<div className="grid grid-cols-6 gap-2">
				{STAGES.map((stage) => (
					<div key={stage.key} className={`rounded-t-lg p-3 ${stage.bgColor}`}>
						<div className="flex items-center justify-between">
							<span className={`text-sm font-medium ${stage.color}`}>{stage.label}</span>
							<span className="text-xs text-slate-500">{getDealsByStage(stage.key).length}</span>
						</div>
						<p className={`text-lg font-bold ${stage.color}`}>
							{formatCurrency(getStageValue(stage.key))}
						</p>
					</div>
				))}
			</div>

			{/* Pipeline Columns */}
			<div className="grid grid-cols-6 gap-2 min-h-[400px]">
				{STAGES.map((stage) => (
					<div
						key={stage.key}
						className="rounded-b-lg border border-slate-700 bg-slate-800/50 p-2 space-y-2"
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, stage.key)}
					>
						{getDealsByStage(stage.key).map((deal) => (
							<motion.div
								key={deal.id}
								draggable
								onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, deal.id)}
								onClick={() => { setSelectedDeal(deal); onDealClick?.(deal); }}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								whileHover={{ scale: 1.02 }}
								className={`
									cursor-pointer rounded-lg border border-slate-600 bg-slate-700/80 p-3 
									hover:border-brand-500/50 hover:bg-slate-700 transition-all
									${selectedDeal?.id === deal.id ? "ring-2 ring-brand-500" : ""}
									${draggedDeal === deal.id ? "opacity-50" : ""}
								`}
							>
								<p className="font-medium text-white text-sm truncate">{deal.customerName}</p>
								<p className="text-xs text-slate-400 truncate">{deal.address}</p>
								<div className="mt-2 flex items-center justify-between">
									<span className="text-sm font-semibold text-emerald-400">
										{formatCurrency(deal.estimatedValue)}
									</span>
									{deal.daysInStage > 0 && (
										<span className={`text-xs ${deal.daysInStage > 5 ? "text-orange-400" : "text-slate-500"}`}>
											{deal.daysInStage}d
										</span>
									)}
								</div>
								{deal.insuranceCompany && (
									<p className="mt-1 text-xs text-slate-500 truncate">{deal.insuranceCompany}</p>
								)}
							</motion.div>
						))}

						{getDealsByStage(stage.key).length === 0 && (
							<div className="flex items-center justify-center h-24 text-slate-500 text-xs text-center">
								No deals
							</div>
						)}
					</div>
				))}
			</div>

			{/* Selected Deal Detail */}
			{selectedDeal && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-xl border border-slate-700 bg-slate-800 p-4"
				>
					<div className="flex items-start justify-between">
						<div>
							<h3 className="text-lg font-semibold text-white">{selectedDeal.customerName}</h3>
							<p className="text-sm text-slate-400">{selectedDeal.address}</p>
						</div>
						<button 
							onClick={() => setSelectedDeal(null)}
							className="text-slate-400 hover:text-white"
						>
							✕
						</button>
					</div>
					<div className="mt-4 grid grid-cols-4 gap-4">
						<div>
							<p className="text-xs text-slate-500">Estimated Value</p>
							<p className="text-lg font-bold text-emerald-400">{formatCurrency(selectedDeal.estimatedValue)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Stage</p>
							<p className="text-sm font-medium text-white capitalize">{selectedDeal.stage.replace("_", " ")}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Insurance</p>
							<p className="text-sm font-medium text-white">{selectedDeal.insuranceCompany || "N/A"}</p>
						</div>
						<div>
							<p className="text-xs text-slate-500">Last Activity</p>
							<p className="text-sm text-slate-300">{selectedDeal.lastActivity || "None"}</p>
						</div>
					</div>
					<div className="mt-4 flex gap-2">
						<button className="button-secondary text-sm flex-1">Generate Report</button>
						<button className="button-secondary text-sm flex-1">Send Follow-up</button>
						<button className="button-primary text-sm flex-1">Update Stage</button>
					</div>
				</motion.div>
			)}
		</div>
	);
}
