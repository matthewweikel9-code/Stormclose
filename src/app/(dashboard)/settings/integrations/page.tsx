"use client";

import { useState, useEffect } from "react";
import { Link2, CheckCircle, XCircle, Loader2, AlertTriangle, Layers, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IntegrationStatus {
	connected: boolean;
	connectedAt: string | null;
}

export default function IntegrationsPage() {
	const [jnApiKey, setJnApiKey] = useState("");
	const [jnStatus, setJnStatus] = useState<IntegrationStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [connecting, setConnecting] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => { checkJobNimbusStatus(); }, []);

	const checkJobNimbusStatus = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/integrations/jobnimbus/connect");
			if (res.ok) { const data = await res.json(); setJnStatus(data); }
		} catch (err) {
			console.error("Failed to check JN status:", err);
		} finally { setLoading(false); }
	};

	const connectJobNimbus = async () => {
		if (!jnApiKey.trim()) { setError("Please enter your JobNimbus API key"); return; }
		setConnecting(true);
		setError(null);
		setSuccess(null);
		try {
			const res = await fetch("/api/integrations/jobnimbus/connect", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apiKey: jnApiKey }),
			});
			const data = await res.json();
			if (!res.ok) { setError(data.error || "Failed to connect"); return; }
			setSuccess("JobNimbus connected successfully!");
			setJnApiKey("");
			checkJobNimbusStatus();
		} catch {
			setError("Failed to connect to JobNimbus");
		} finally { setConnecting(false); }
	};

	const disconnectJobNimbus = async () => {
		if (!confirm("Are you sure you want to disconnect JobNimbus?")) return;
		setDisconnecting(true);
		setError(null);
		try {
			const res = await fetch("/api/integrations/jobnimbus/connect", { method: "DELETE" });
			if (res.ok) {
				setJnStatus({ connected: false, connectedAt: null });
				setSuccess("JobNimbus disconnected");
			}
		} catch {
			setError("Failed to disconnect");
		} finally { setDisconnecting(false); }
	};

	return (
		<div className="max-w-3xl space-y-5">
			<div>
				<h1 className="text-lg font-bold text-white">Integrations</h1>
				<p className="text-2xs text-storm-subtle mt-0.5">Connect StormClose AI with your favorite tools</p>
			</div>

			{error && (
				<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
					<XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
					<p className="text-sm text-red-400">{error}</p>
				</div>
			)}

			{success && (
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2">
					<CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
					<p className="text-sm text-emerald-400">{success}</p>
				</div>
			)}

			{/* JobNimbus Integration */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15">
								<Layers className="h-5 w-5 text-blue-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold text-white">JobNimbus</h2>
								<p className="text-2xs text-storm-subtle">Export leads directly to your JobNimbus CRM</p>
							</div>
						</div>
						{loading ? (
							<Loader2 className="h-5 w-5 text-storm-subtle animate-spin" />
						) : jnStatus?.connected ? (
							<Badge variant="success">Connected</Badge>
						) : (
							<Badge variant="default">Not Connected</Badge>
						)}
					</div>

					{jnStatus?.connected ? (
						<div className="space-y-3">
							<div className="glass-subtle flex items-center justify-between rounded-xl px-4 py-3">
								<div>
									<p className="text-2xs text-storm-subtle uppercase tracking-wider font-medium">Connected since</p>
									<p className="text-sm font-medium text-white mt-0.5">
										{jnStatus.connectedAt
											? new Date(jnStatus.connectedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
											: "Unknown"}
									</p>
								</div>
								<button onClick={disconnectJobNimbus} disabled={disconnecting} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
									{disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disconnect"}
								</button>
							</div>

							<div className="glass-subtle rounded-xl px-4 py-3">
								<h4 className="text-2xs text-storm-subtle uppercase tracking-wider font-medium mb-2">What you can do</h4>
								<ul className="space-y-1.5">
									<li className="flex items-center gap-2 text-xs text-storm-muted">
										<CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
										Export leads to JobNimbus as contacts
									</li>
									<li className="flex items-center gap-2 text-xs text-storm-muted">
										<CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
										Lead scores and storm data are included in notes
									</li>
									<li className="flex items-center gap-2 text-xs text-storm-muted">
										<CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
										Leads are tagged with &quot;StormClose&quot; for easy filtering
									</li>
								</ul>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							<div className="glass-subtle rounded-xl px-4 py-3 flex items-start gap-3">
								<AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
								<div>
									<h4 className="text-xs font-medium text-amber-400">How to get your API key</h4>
									<ol className="text-xs text-storm-muted mt-1.5 space-y-1">
										<li>1. Log in to your JobNimbus account</li>
										<li>2. Go to Settings → API Keys</li>
										<li>3. Click &quot;Create API Key&quot;</li>
										<li>4. Copy the key and paste it below</li>
									</ol>
								</div>
							</div>

							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">JobNimbus API Key</label>
								<input type="password" value={jnApiKey} onChange={(e) => setJnApiKey(e.target.value)} placeholder="Enter your API key" className="dashboard-input" />
							</div>

							<button onClick={connectJobNimbus} disabled={connecting || !jnApiKey.trim()} className="button-primary w-full flex items-center justify-center gap-2 text-sm">
								{connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
								{connecting ? "Connecting..." : "Connect JobNimbus"}
							</button>
						</div>
					)}
				</div>
			</section>

			{/* Xactimate Integration (Coming Soon) */}
			<section className="storm-card overflow-hidden opacity-60">
				<div className="p-5">
					<div className="flex items-center gap-3">
						<div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
							<ClipboardCheck className="h-5 w-5 text-emerald-400" />
						</div>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<h2 className="text-sm font-semibold text-white">Xactimate</h2>
								<Badge variant="default">Coming Soon</Badge>
							</div>
							<p className="text-2xs text-storm-subtle mt-0.5">Import ESX files for supplement analysis</p>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
