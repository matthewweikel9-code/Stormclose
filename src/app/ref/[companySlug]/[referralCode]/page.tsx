"use client";

import { FormEvent, useState } from "react";
import { CheckCircle, Upload, AlertTriangle } from "lucide-react";

export default function PublicReferralFormPage({
	params,
}: {
	params: { companySlug: string; referralCode: string };
}) {
	const [propertyAddress, setPropertyAddress] = useState("");
	const [homeownerName, setHomeownerName] = useState("");
	const [homeownerPhone, setHomeownerPhone] = useState("");
	const [homeownerEmail, setHomeownerEmail] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [zip, setZip] = useState("");
	const [notes, setNotes] = useState("");
	const [formState, setFormState] = useState<"idle" | "submitting" | "done" | "error">("idle");
	const [message, setMessage] = useState("");

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setFormState("submitting");
		setMessage("");
		try {
			const res = await fetch("/api/partner-engine/public/referrals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companySlug: params.companySlug,
					referralCode: params.referralCode,
					propertyAddress,
					homeownerName: homeownerName || null,
					homeownerPhone: homeownerPhone || null,
					homeownerEmail: homeownerEmail || null,
					city: city || null,
					state: state || null,
					zip: zip || null,
					notes: notes || null,
				}),
			});
			const payload = (await res.json()) as { error?: string };
			if (!res.ok) throw new Error(payload?.error || "Failed to submit referral");
			setFormState("done");
			setMessage("Referral submitted successfully. The roofing team will follow up shortly.");
		} catch (error) {
			setFormState("error");
			setMessage(error instanceof Error ? error.message : "Failed to submit referral");
		}
	}

	if (formState === "done") {
		return (
			<main className="min-h-screen bg-storm-bg flex items-center justify-center px-4">
				<div className="mx-auto max-w-lg text-center rounded-2xl border border-storm-border bg-storm-z0 p-8">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
						<CheckCircle className="h-8 w-8 text-emerald-400" />
					</div>
					<h1 className="text-2xl font-bold text-white">Referral Submitted</h1>
					<p className="mt-3 text-sm text-storm-subtle">{message}</p>
					<p className="mt-6 text-xs text-storm-subtle">Powered by StormClose Referral Engine</p>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-storm-bg px-4 py-8 sm:py-12">
			<div className="mx-auto max-w-2xl">
				<div className="rounded-2xl border border-storm-border bg-storm-z0 overflow-hidden">
					<div className="bg-gradient-to-r from-storm-purple/10 to-storm-glow/5 border-b border-storm-border px-6 py-5">
						<p className="text-xs uppercase tracking-[0.2em] text-storm-glow">StormClose Referral</p>
						<h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">Submit a Property Referral</h1>
						<p className="mt-1 text-sm text-storm-subtle">
							Know a homeowner who may need roof repair? Fill out the form below.
						</p>
					</div>

					<form onSubmit={(e) => void onSubmit(e)} className="p-6 space-y-4">
						<div>
							<label className="block text-xs font-semibold text-storm-subtle mb-1">Property Address *</label>
							<input
								required
								value={propertyAddress}
								onChange={(e) => setPropertyAddress(e.target.value)}
								placeholder="123 Main St"
								className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50 focus:ring-1 focus:ring-storm-purple/20"
							/>
						</div>

						<div className="grid gap-3 sm:grid-cols-3">
							<div>
								<label className="block text-xs font-semibold text-storm-subtle mb-1">City</label>
								<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Oklahoma City" className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
							</div>
							<div>
								<label className="block text-xs font-semibold text-storm-subtle mb-1">State</label>
								<input value={state} onChange={(e) => setState(e.target.value)} placeholder="OK" maxLength={2} className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
							</div>
							<div>
								<label className="block text-xs font-semibold text-storm-subtle mb-1">ZIP</label>
								<input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="73013" maxLength={5} className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
							</div>
						</div>

						<div className="border-t border-storm-border pt-4">
							<p className="text-xs font-semibold text-storm-subtle mb-3">Homeowner Contact (recommended)</p>
							<div className="space-y-3">
								<input value={homeownerName} onChange={(e) => setHomeownerName(e.target.value)} placeholder="Homeowner name" className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
								<div className="grid gap-3 sm:grid-cols-2">
									<input value={homeownerPhone} onChange={(e) => setHomeownerPhone(e.target.value)} placeholder="Phone" type="tel" className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
									<input value={homeownerEmail} onChange={(e) => setHomeownerEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50" />
								</div>
							</div>
						</div>

						<div>
							<label className="block text-xs font-semibold text-storm-subtle mb-1">Notes</label>
							<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible damage, urgency, etc." rows={3} className="w-full rounded-lg border border-storm-border bg-storm-z1 px-3 py-2.5 text-sm text-white outline-none focus:border-storm-purple/50 resize-none" />
						</div>

						<div className="rounded-lg border border-dashed border-storm-border bg-storm-z1 p-4 text-center">
							<Upload className="mx-auto h-6 w-6 text-storm-subtle" />
							<p className="mt-1 text-xs text-storm-subtle">Photo upload coming soon</p>
						</div>

						{formState === "error" && (
							<div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
								<AlertTriangle className="h-4 w-4 flex-shrink-0" />
								{message}
							</div>
						)}

						<button
							disabled={formState === "submitting"}
							className="w-full rounded-lg bg-storm-purple py-3 text-sm font-semibold text-white transition-all hover:bg-storm-purple-hover disabled:opacity-50"
						>
							{formState === "submitting" ? "Submitting..." : "Submit Referral"}
						</button>

						<p className="text-center text-xs text-storm-subtle">Powered by StormClose Referral Engine</p>
					</form>
				</div>
			</div>
		</main>
	);
}
