"use client";

import { useState, useEffect } from "react";
import { Building2, MapPin, Shield, Globe, Loader2, Save, CheckCircle } from "lucide-react";

interface CompanyData {
	company_name: string;
	company_phone: string;
	company_email: string;
	company_address: string;
	company_city: string;
	company_state: string;
	company_zip: string;
	license_number: string;
	insurance_info: string;
	website: string;
}

export default function CompanySettingsPage() {
	const [company, setCompany] = useState<CompanyData>({
		company_name: "", company_phone: "", company_email: "",
		company_address: "", company_city: "", company_state: "",
		company_zip: "", license_number: "", insurance_info: "", website: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	useEffect(() => { loadCompany(); }, []);

	const loadCompany = async () => {
		try {
			const res = await fetch("/api/auth/me");
			if (res.ok) {
				const data = await res.json();
				const meta = data.user?.user_metadata || {};
				setCompany({
					company_name: meta.company_name || "", company_phone: meta.company_phone || "",
					company_email: meta.company_email || "", company_address: meta.company_address || "",
					company_city: meta.company_city || "", company_state: meta.company_state || "",
					company_zip: meta.company_zip || "", license_number: meta.license_number || "",
					insurance_info: meta.insurance_info || "", website: meta.website || "",
				});
			}
		} catch (error) {
			console.error("Error loading company:", error);
		} finally { setLoading(false); }
	};

	const handleSave = async () => {
		setSaving(true);
		setSaved(false);
		setMessage(null);
		try {
			const res = await fetch("/api/auth/update-profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(company),
			});
			if (res.ok) {
				setSaved(true);
				setMessage({ type: "success", text: "Company information updated successfully" });
				setTimeout(() => setSaved(false), 3000);
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to update company info" });
			}
		} catch {
			setMessage({ type: "error", text: "Failed to update company info" });
		} finally { setSaving(false); }
	};

	if (loading) {
		return (
			<div className="max-w-2xl space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-7 w-48 rounded-lg" /><div className="skeleton h-10 w-36 rounded-xl" /></div>
				{[1, 2, 3].map((i) => (
					<div key={i} className="storm-card p-5 space-y-4">
						<div className="skeleton h-5 w-36 rounded" />
						<div className="skeleton h-10 w-full rounded-xl" />
						<div className="skeleton h-10 w-full rounded-xl" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="max-w-2xl space-y-5">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold text-white">Company Settings</h1>
					<p className="text-2xs text-storm-subtle mt-0.5">Manage your company details for reports and estimates</p>
				</div>
				<button type="button" onClick={() => void handleSave()} disabled={saving} className="button-primary flex items-center gap-2 text-sm">
					{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
					{saved ? "Saved" : "Save Changes"}
				</button>
			</div>

			{message && (
				<div className={`rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
					{message.text}
				</div>
			)}

			{/* Company Details */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-storm-purple/15">
							<Building2 className="h-4 w-4 text-storm-glow" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Company Details</h2>
							<p className="text-2xs text-storm-subtle">Basic business information</p>
						</div>
					</div>
					<div className="space-y-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Company Name</label>
							<input type="text" value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} className="dashboard-input" placeholder="Your Roofing Company LLC" />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Business Phone</label>
								<input type="tel" value={company.company_phone} onChange={(e) => setCompany({ ...company, company_phone: e.target.value })} className="dashboard-input" placeholder="(555) 123-4567" />
							</div>
							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Business Email</label>
								<input type="email" value={company.company_email} onChange={(e) => setCompany({ ...company, company_email: e.target.value })} className="dashboard-input" placeholder="info@yourcompany.com" />
							</div>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Website</label>
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4 text-storm-subtle flex-shrink-0" />
								<input type="url" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} className="dashboard-input flex-1" placeholder="https://www.yourcompany.com" />
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Business Address */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
							<MapPin className="h-4 w-4 text-blue-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Business Address</h2>
							<p className="text-2xs text-storm-subtle">Used on estimates and reports</p>
						</div>
					</div>
					<div className="space-y-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Street Address</label>
							<input type="text" value={company.company_address} onChange={(e) => setCompany({ ...company, company_address: e.target.value })} className="dashboard-input" placeholder="123 Main St" />
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">City</label>
								<input type="text" value={company.company_city} onChange={(e) => setCompany({ ...company, company_city: e.target.value })} className="dashboard-input" placeholder="Dallas" />
							</div>
							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">State</label>
								<input type="text" value={company.company_state} onChange={(e) => setCompany({ ...company, company_state: e.target.value })} className="dashboard-input" placeholder="TX" maxLength={2} />
							</div>
							<div>
								<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">ZIP Code</label>
								<input type="text" value={company.company_zip} onChange={(e) => setCompany({ ...company, company_zip: e.target.value })} className="dashboard-input" placeholder="75201" maxLength={10} />
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* License & Insurance */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
							<Shield className="h-4 w-4 text-emerald-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">License & Insurance</h2>
							<p className="text-2xs text-storm-subtle">Compliance and credentials</p>
						</div>
					</div>
					<div className="space-y-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Contractor License Number</label>
							<input type="text" value={company.license_number} onChange={(e) => setCompany({ ...company, license_number: e.target.value })} className="dashboard-input" placeholder="License #" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Insurance Information</label>
							<textarea value={company.insurance_info} onChange={(e) => setCompany({ ...company, insurance_info: e.target.value })} className="dashboard-textarea h-24" placeholder="Insurance provider, policy number, coverage details..." />
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
