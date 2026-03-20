"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Zap, Camera, Link2, X, Check, ChevronRight } from "lucide-react";

const STORAGE_KEY = "stormclose_onboarding_dismissed";

interface OnboardingChecklistProps {
	jobnimbusConnected?: boolean;
	hasDefaultLocation?: boolean;
}

const steps = [
	{
		id: "jobnimbus",
		label: "Connect JobNimbus",
		href: "/dashboard/team",
		icon: Link2,
		optional: true,
	},
	{
		id: "location",
		label: "Set your default location",
		href: "/settings",
		icon: MapPin,
		optional: false,
	},
	{
		id: "storm-ops",
		label: "Open Storm Ops — scan for hail",
		href: "/dashboard/storm-map",
		icon: Zap,
		optional: false,
	},
	{
		id: "ai-engine",
		label: "Try AI Image Engine — upload a roof photo",
		href: "/dashboard/ai-image-engine",
		icon: Camera,
		optional: false,
	},
];

export function OnboardingChecklist({
	jobnimbusConnected = false,
	hasDefaultLocation = false,
}: OnboardingChecklistProps) {
	const [dismissed, setDismissed] = useState(true);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = localStorage.getItem(STORAGE_KEY);
		setDismissed(stored === "true");
	}, []);

	const handleDismiss = () => {
		localStorage.setItem(STORAGE_KEY, "true");
		setDismissed(true);
	};

	if (dismissed) return null;

	return (
		<div className="rounded-xl border border-storm-purple/30 bg-gradient-to-b from-storm-purple/10 to-transparent p-4 mb-6 animate-fade-in">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="text-sm font-semibold text-white flex items-center gap-2">
						<Zap className="h-4 w-4 text-storm-glow" />
						Get started in 4 steps
					</h3>
					<p className="mt-1 text-xs text-storm-subtle">
						Complete these to get the most from StormClose. Takes about 5 minutes.
					</p>
				</div>
				<button
					onClick={handleDismiss}
					className="p-1 rounded hover:bg-storm-z2 text-storm-subtle hover:text-white transition-colors"
					aria-label="Dismiss"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{steps.map((step) => {
					const Icon = step.icon;
					const isComplete =
						(step.id === "jobnimbus" && jobnimbusConnected) ||
						(step.id === "location" && hasDefaultLocation);
					return (
						<Link
							key={step.id}
							href={step.href}
							className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
								isComplete
									? "border-emerald-500/30 bg-emerald-500/5"
									: "border-storm-border bg-storm-z1/50 hover:border-storm-purple/30 hover:bg-storm-z1"
							}`}
						>
							{isComplete ? (
								<Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
							) : (
								<Icon className="h-4 w-4 text-storm-glow flex-shrink-0" />
							)}
							<div className="min-w-0">
								<span className={`text-sm font-medium ${isComplete ? "text-emerald-300" : "text-white"}`}>
									{step.label}
								</span>
								{step.optional && (
									<span className="ml-1 text-[10px] text-storm-subtle">(optional)</span>
								)}
							</div>
							{!isComplete && (
								<ChevronRight className="h-3.5 w-3.5 text-storm-subtle flex-shrink-0 ml-auto" />
							)}
						</Link>
					);
				})}
			</div>
		</div>
	);
}
