"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle } from "lucide-react";

type ApiEnvelope<T> = { data: T | null; error: string | null; meta: Record<string, unknown> };

interface Settings {
	companySlug: string;
	defaultRewardType: string;
	defaultRewardAmount: number;
	slaContactHours: number;
	autoRewardOnInstall: boolean;
	notifyPartnersOnStorm: boolean;
	jobnimbusSyncStage: string;
}

const SYNC_STAGES = [
	"received",
	"contacted",
	"inspection_scheduled",
	"inspection_complete",
	"claim_filed",
	"approved",
	"roof_installed",
	"closed",
];

export default function PartnerEngineSettingsPage() {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		void (async () => {
			try {
				const res = await fetch("/api/partner-engine/settings");
				const json = (await res.json()) as ApiEnvelope<Settings>;
				if (json.error) throw new Error(json.error);
				setSettings(json.data);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load settings");
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const handleSave = async () => {
		if (!settings) return;
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			const res = await fetch("/api/partner-engine/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
			const json = (await res.json()) as ApiEnvelope<Settings>;
			if (json.error) throw new Error(json.error);
			setSettings(json.data);
			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-[40vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-storm-purple" />
			</div>
		);
	}

	if (!settings) {
		return (
			<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
				{error ?? "Failed to load settings"}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold text-white">Settings</h1>
				<button
					type="button"
					onClick={() => void handleSave()}
					disabled={saving}
					className="inline-flex items-center gap-2 rounded-xl bg-storm-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm-purple/90 disabled:opacity-50"
				>
					{saving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : saved ? (
						<CheckCircle className="h-4 w-4 text-emerald-400" />
					) : (
						<Save className="h-4 w-4" />
					)}
					{saved ? "Saved" : "Save Settings"}
				</button>
			</div>

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
					{error}
				</div>
			)}

			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6 space-y-6">
				<div>
					<h2 className="text-sm font-semibold text-white">Company</h2>
					<p className="text-xs text-storm-subtle mt-1">
						Your company slug is used in partner referral links.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label className="block text-xs font-medium text-storm-muted">
							Company Slug
						</label>
						<div className="mt-1 flex items-center gap-2">
							<span className="text-xs text-storm-subtle">/ref/</span>
							<input
								value={settings.companySlug}
								onChange={(e) =>
									setSettings((s) => s && { ...s, companySlug: e.target.value })
								}
								className="flex-1 rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
								placeholder="your-company"
							/>
							<span className="text-xs text-storm-subtle">/code</span>
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6 space-y-6">
				<div>
					<h2 className="text-sm font-semibold text-white">Reward Rules</h2>
					<p className="text-xs text-storm-subtle mt-1">
						Configure how referral rewards are calculated and distributed.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">
					<div>
						<label className="block text-xs font-medium text-storm-muted">
							Default Reward Type
						</label>
						<select
							value={settings.defaultRewardType}
							onChange={(e) =>
								setSettings((s) => s && { ...s, defaultRewardType: e.target.value })
							}
							className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none"
						>
							<option value="flat">Flat Amount</option>
							<option value="percentage">Percentage of Contract</option>
						</select>
					</div>
					<div>
						<label className="block text-xs font-medium text-storm-muted">
							Default Reward Amount
						</label>
						<div className="mt-1 flex items-center gap-1">
							<span className="text-sm text-storm-subtle">
								{settings.defaultRewardType === "flat" ? "$" : ""}
							</span>
							<input
								type="number"
								min="0"
								step={settings.defaultRewardType === "percentage" ? "0.5" : "1"}
								value={settings.defaultRewardAmount}
								onChange={(e) =>
									setSettings((s) =>
										s && { ...s, defaultRewardAmount: Number(e.target.value) || 0 }
									)
								}
								className="flex-1 rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
							/>
							<span className="text-sm text-storm-subtle">
								{settings.defaultRewardType === "percentage" ? "%" : ""}
							</span>
						</div>
					</div>
					<div className="flex items-end">
						<label className="flex items-center gap-3 rounded-xl border border-storm-border bg-storm-z0 px-4 py-3 cursor-pointer hover:bg-storm-z2 transition-colors w-full">
							<input
								type="checkbox"
								checked={settings.autoRewardOnInstall}
								onChange={(e) =>
									setSettings((s) =>
										s && { ...s, autoRewardOnInstall: e.target.checked }
									)
								}
								className="h-4 w-4 rounded border-storm-border accent-storm-purple"
							/>
							<div>
								<span className="text-sm text-white">Auto-reward on install</span>
								<p className="text-[10px] text-storm-subtle">
									Creates a pending reward when status hits &ldquo;Roof Installed&rdquo;
								</p>
							</div>
						</label>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6 space-y-6">
				<div>
					<h2 className="text-sm font-semibold text-white">SLA & Pipeline</h2>
					<p className="text-xs text-storm-subtle mt-1">
						Configure response deadlines and CRM sync behavior.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label className="block text-xs font-medium text-storm-muted">
							SLA: Contact Within (hours)
						</label>
						<input
							type="number"
							min="1"
							max="168"
							value={settings.slaContactHours}
							onChange={(e) =>
								setSettings((s) =>
									s && { ...s, slaContactHours: Number(e.target.value) || 24 }
								)
							}
							className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none focus:ring-2 focus:ring-storm-purple/20"
						/>
						<p className="mt-1 text-[10px] text-storm-subtle">
							Referrals will have a &ldquo;Contact By&rdquo; deadline set to this many hours after submission.
						</p>
					</div>
					<div>
						<label className="block text-xs font-medium text-storm-muted">
							Push to JobNimbus at Stage
						</label>
						<select
							value={settings.jobnimbusSyncStage}
							onChange={(e) =>
								setSettings((s) =>
									s && { ...s, jobnimbusSyncStage: e.target.value }
								)
							}
							className="mt-1 w-full rounded-xl border border-storm-border bg-storm-z0 px-3 py-2 text-sm text-white focus:border-storm-purple focus:outline-none"
						>
							{SYNC_STAGES.map((s) => (
								<option key={s} value={s}>
									{s.replace(/_/g, " ")}
								</option>
							))}
						</select>
						<p className="mt-1 text-[10px] text-storm-subtle">
							Referrals are eligible for CRM push when they reach this stage.
						</p>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-storm-border bg-storm-z1 p-6 space-y-6">
				<div>
					<h2 className="text-sm font-semibold text-white">Notifications</h2>
					<p className="text-xs text-storm-subtle mt-1">
						Configure automated notifications for your partner network.
					</p>
				</div>

				<label className="flex items-center gap-3 rounded-xl border border-storm-border bg-storm-z0 px-4 py-3 cursor-pointer hover:bg-storm-z2 transition-colors">
					<input
						type="checkbox"
						checked={settings.notifyPartnersOnStorm}
						onChange={(e) =>
							setSettings((s) =>
								s && { ...s, notifyPartnersOnStorm: e.target.checked }
							)
						}
						className="h-4 w-4 rounded border-storm-border accent-storm-purple"
					/>
					<div>
						<span className="text-sm text-white">Storm-triggered partner alerts</span>
						<p className="text-[10px] text-storm-subtle">
							When Storm Intelligence detects hail/wind in your territory, automatically email active partners with their referral link.
						</p>
					</div>
				</label>
			</section>
		</div>
	);
}
