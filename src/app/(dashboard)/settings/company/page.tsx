"use client";

import { useState, useEffect } from "react";

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
		company_name: "",
		company_phone: "",
		company_email: "",
		company_address: "",
		company_city: "",
		company_state: "",
		company_zip: "",
		license_number: "",
		insurance_info: "",
		website: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	useEffect(() => {
		loadCompany();
	}, []);

	const loadCompany = async () => {
		try {
			const res = await fetch("/api/auth/me");
			if (res.ok) {
				const data = await res.json();
				const meta = data.user?.user_metadata || {};
				setCompany({
					company_name: meta.company_name || "",
					company_phone: meta.company_phone || "",
					company_email: meta.company_email || "",
					company_address: meta.company_address || "",
					company_city: meta.company_city || "",
					company_state: meta.company_state || "",
					company_zip: meta.company_zip || "",
					license_number: meta.license_number || "",
					insurance_info: meta.insurance_info || "",
					website: meta.website || "",
				});
			}
		} catch (error) {
			console.error("Error loading company:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		setSaving(true);
		setMessage(null);
		try {
			const res = await fetch("/api/auth/update-profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(company),
			});

			if (res.ok) {
				setMessage({ type: "success", text: "Company information updated successfully" });
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to update company info" });
			}
		} catch (error) {
			setMessage({ type: "error", text: "Failed to update company info" });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="p-6 max-w-2xl mx-auto">
				<div className="animate-pulse space-y-4">
					<div className="h-8 bg-zinc-800 rounded w-48" />
					<div className="h-64 bg-zinc-800 rounded-xl" />
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-2xl mx-auto">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Company Settings</h1>
				<p className="text-zinc-400 text-sm mt-1">Manage your company details for reports and estimates</p>
			</div>

			{message && (
				<div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-red-500/20 text-red-400 border border-red-500/50"}`}>
					{message.text}
				</div>
			)}

			{/* Company Details */}
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">Company Details</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Company Name</label>
						<input
							type="text"
							value={company.company_name}
							onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="Your Roofing Company LLC"
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm text-zinc-400 mb-1">Business Phone</label>
							<input
								type="tel"
								value={company.company_phone}
								onChange={(e) => setCompany({ ...company, company_phone: e.target.value })}
								className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="(555) 123-4567"
							/>
						</div>
						<div>
							<label className="block text-sm text-zinc-400 mb-1">Business Email</label>
							<input
								type="email"
								value={company.company_email}
								onChange={(e) => setCompany({ ...company, company_email: e.target.value })}
								className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="info@yourcompany.com"
							/>
						</div>
					</div>
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Website</label>
						<input
							type="url"
							value={company.website}
							onChange={(e) => setCompany({ ...company, website: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="https://www.yourcompany.com"
						/>
					</div>
				</div>
			</div>

			{/* Address */}
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">Business Address</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Street Address</label>
						<input
							type="text"
							value={company.company_address}
							onChange={(e) => setCompany({ ...company, company_address: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="123 Main St"
						/>
					</div>
					<div className="grid grid-cols-3 gap-4">
						<div>
							<label className="block text-sm text-zinc-400 mb-1">City</label>
							<input
								type="text"
								value={company.company_city}
								onChange={(e) => setCompany({ ...company, company_city: e.target.value })}
								className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="Dallas"
							/>
						</div>
						<div>
							<label className="block text-sm text-zinc-400 mb-1">State</label>
							<input
								type="text"
								value={company.company_state}
								onChange={(e) => setCompany({ ...company, company_state: e.target.value })}
								className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="TX"
								maxLength={2}
							/>
						</div>
						<div>
							<label className="block text-sm text-zinc-400 mb-1">ZIP Code</label>
							<input
								type="text"
								value={company.company_zip}
								onChange={(e) => setCompany({ ...company, company_zip: e.target.value })}
								className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="75201"
								maxLength={10}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* License & Insurance */}
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">License & Insurance</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Contractor License Number</label>
						<input
							type="text"
							value={company.license_number}
							onChange={(e) => setCompany({ ...company, license_number: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="License #"
						/>
					</div>
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Insurance Information</label>
						<textarea
							value={company.insurance_info}
							onChange={(e) => setCompany({ ...company, insurance_info: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 h-24 resize-none"
							placeholder="Insurance provider, policy number, coverage details..."
						/>
					</div>
				</div>
			</div>

			{/* Save Button */}
			<div className="flex justify-end">
				<button
					onClick={handleSave}
					disabled={saving}
					className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-lg font-medium transition-colors flex items-center gap-2"
				>
					{saving ? (
						<>
							<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							Saving...
						</>
					) : (
						"Save Changes"
					)}
				</button>
			</div>
		</div>
	);
}
