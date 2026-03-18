"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle, Building2, Gift, Clock, Bell } from "lucide-react";

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
	"received", "contacted", "inspection_scheduled", "inspection_complete",
	"claim_filed", "approved", "roof_installed", "closed",
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
			} finally { setLoading(false); }
		})();
	}, []);

	const handleSave = async () => {
		if (!settings) return;
		setSaving(true);
		setSaved(false);
		setError(null);
		try {
			const res = await fetch("/api/partner-engine/settings", {
				method: "PUT", headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
			const json = (await res.json()) as ApiEnvelope<Settings>;
			if (json.error) throw new Error(json.error);
			setSettings(json.data);
			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save settings");
		} finally { setSaving(false); }
	};

	if (loading) {
		return (
			<div className="space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-8 w-32 rounded-lg" /><div className="skeleton h-10 w-36 rounded-xl" /></div>
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="storm-card p-5 space-y-4">
						<div className="skeleton h-5 w-40 rounded" />
						<div className="skeleton h-10 w-full rounded-xl" />
					</div>
				))}
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
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-bold text-white">Settings</h1>
				<button type="button" onClick={() => void handleSave()} disabled={saving} className="button-primary flex items-center gap-2 text-sm">
					{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
					{saved ? "Saved" : "Save Settings"}
				</button>
			</div>

			{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">{error}</div>}

			{/* Company Section */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-storm-purple/15">
							<Building2 className="h-4 w-4 text-storm-glow" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Company</h2>
							<p className="text-2xs text-storm-subtle">Your company slug is used in partner referral links.</p>
						</div>
					</div>
					<div className="max-w-md">
						<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Company Slug</label>
						<div className="flex items-center gap-2">
							<span className="text-xs text-storm-subtle">/ref/</span>
							<input
								value={settings.companySlug}
								onChange={(e) => setSettings((s) => s && { ...s, companySlug: e.target.value })}
								className="dashboard-input flex-1"
								placeholder="your-company"
							/>
							<span className="text-xs text-storm-subtle">/code</span>
						</div>
					</div>
				</div>
			</section>

			{/* Reward Rules Section */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
							<Gift className="h-4 w-4 text-amber-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Reward Rules</h2>
							<p className="text-2xs text-storm-subtle">Configure how referral rewards are calculated and distributed.</p>
						</div>
					</div>
					<div className="grid gap-3 sm:grid-cols-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Default Reward Type</label>
							<select
								value={settings.defaultRewardType}
								onChange={(e) => setSettings((s) => s && { ...s, defaultRewardType: e.target.value })}
								className="dashboard-select"
							>
								<option value="flat">Flat Amount</option>
								<option value="percentage">Percentage of Contract</option>
							</select>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Default Reward Amount</label>
							<div className="flex items-center gap-1">
								<span className="text-sm text-storm-subtle">{settings.defaultRewardType === "flat" ? "$" : ""}</span>
								<input
									type="number" min="0"
									step={settings.defaultRewardType === "percentage" ? "0.5" : "1"}
									value={settings.defaultRewardAmount}
									onChange={(e) => setSettings((s) => s && { ...s, defaultRewardAmount: Number(e.target.value) || 0 })}
									className="dashboard-input flex-1"
								/>
								<span className="text-sm text-storm-subtle">{settings.defaultRewardType === "percentage" ? "%" : ""}</span>
							</div>
						</div>
						<div className="flex items-end">
							<label className="glass-subtle flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer hover:bg-storm-z2/60 transition-colors w-full">
								<input
									type="checkbox"
									checked={settings.autoRewardOnInstall}
									onChange={(e) => setSettings((s) => s && { ...s, autoRewardOnInstall: e.target.checked })}
									className="h-4 w-4 rounded border-storm-border accent-storm-purple"
								/>
								<div>
									<span className="text-sm text-white">Auto-reward on install</span>
									<p className="text-2xs text-storm-subtle">Creates a pending reward when status hits &ldquo;Roof Installed&rdquo;</p>
								</div>
							</label>
						</div>
					</div>
				</div>
			</section>

			{/* SLA & Pipeline Section */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
							<Clock className="h-4 w-4 text-blue-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">SLA & Pipeline</h2>
							<p className="text-2xs text-storm-subtle">Configure response deadlines and CRM sync behavior.</p>
						</div>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">SLA: Contact Within (hours)</label>
							<input
								type="number" min="1" max="168"
								value={settings.slaContactHours}
								onChange={(e) => setSettings((s) => s && { ...s, slaContactHours: Number(e.target.value) || 24 })}
								className="dashboard-input"
							/>
							<p className="mt-1.5 text-2xs text-storm-subtle">Referrals will have a &ldquo;Contact By&rdquo; deadline set to this many hours after submission.</p>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Push to JobNimbus at Stage</label>
							<select
								value={settings.jobnimbusSyncStage}
								onChange={(e) => setSettings((s) => s && { ...s, jobnimbusSyncStage: e.target.value })}
								className="dashboard-select"
							>
								{SYNC_STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
							</select>
							<p className="mt-1.5 text-2xs text-storm-subtle">Referrals are eligible for CRM push when they reach this stage.</p>
						</div>
					</div>
				</div>
			</section>

			{/* Notifications Section */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
							<Bell className="h-4 w-4 text-emerald-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Notifications</h2>
							<p className="text-2xs text-storm-subtle">Configure automated notifications for your partner network.</p>
						</div>
					</div>
					<label className="glass-subtle flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer hover:bg-storm-z2/60 transition-colors">
						<input
							type="checkbox"
							checked={settings.notifyPartnersOnStorm}
							onChange={(e) => setSettings((s) => s && { ...s, notifyPartnersOnStorm: e.target.checked })}
							className="h-4 w-4 rounded border-storm-border accent-storm-purple"
						/>
						<div>
							<span className="text-sm text-white">Storm-triggered partner alerts</span>
							<p className="text-2xs text-storm-subtle">When Storm Intelligence detects hail/wind in your territory, automatically email active partners with their referral link.</p>
						</div>
					</label>
				</div>
			</section>
		</div>
	);
}
