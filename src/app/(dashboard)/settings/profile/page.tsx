"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Bell, MapPin, Loader2, Save, CheckCircle } from "lucide-react";

interface ProfileData {
	full_name: string;
	email: string;
	phone: string;
	default_location: string;
	default_lat: number | null;
	default_lng: number | null;
	notification_email: boolean;
	notification_sms: boolean;
	notification_storm_alerts: boolean;
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
	return (
		<label className="glass-subtle flex items-center justify-between rounded-xl px-4 py-3.5 cursor-pointer hover:bg-storm-z2/60 transition-colors">
			<div>
				<span className="text-sm font-medium text-white">{label}</span>
				<p className="text-2xs text-storm-subtle mt-0.5">{description}</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-storm-purple" : "bg-storm-z2 border border-storm-border"}`}
			>
				<span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
			</button>
		</label>
	);
}

export default function ProfileSettingsPage() {
	const [profile, setProfile] = useState<ProfileData>({
		full_name: "", email: "", phone: "", default_location: "",
		default_lat: null, default_lng: null,
		notification_email: true, notification_sms: false, notification_storm_alerts: true,
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [geoLoading, setGeoLoading] = useState(false);
	const [geoError, setGeoError] = useState<string | null>(null);

	const useCurrentLocation = useCallback(() => {
		if (!navigator.geolocation) {
			setGeoError("Geolocation is not supported by your browser.");
			return;
		}
		setGeoError(null);
		setGeoLoading(true);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setProfile((prev) => ({
					...prev,
					default_lat: position.coords.latitude,
					default_lng: position.coords.longitude,
					default_location: prev.default_location || `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
				}));
				setGeoLoading(false);
			},
			async (err) => {
				setGeoLoading(false);
				if (err.code === err.PERMISSION_DENIED) {
					setGeoError("Location permission denied. Please enable location access in your browser.");
				} else if (err.code === err.TIMEOUT) {
					setGeoError("Location request timed out.");
				} else {
					setGeoError("Could not get your location. Try entering a city or ZIP manually.");
				}
			},
			{ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
		);
	}, []);

	useEffect(() => {
		loadProfile();
	}, []);

	const loadProfile = async () => {
		try {
			const res = await fetch("/api/auth/me");
			if (res.ok) {
				const data = await res.json();
				setProfile((prev) => ({
					...prev,
					full_name: data.user?.user_metadata?.full_name || data.user?.email?.split("@")[0] || "",
					email: data.user?.email || "",
					phone: data.user?.user_metadata?.phone || "",
					default_location: data.user?.user_metadata?.default_location || "",
					default_lat: data.user?.user_metadata?.default_lat || null,
					default_lng: data.user?.user_metadata?.default_lng || null,
					notification_email: data.user?.user_metadata?.notification_email ?? true,
					notification_sms: data.user?.user_metadata?.notification_sms ?? false,
					notification_storm_alerts: data.user?.user_metadata?.notification_storm_alerts ?? true,
				}));
			}
		} catch (error) {
			console.error("Error loading profile:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		setSaving(true);
		setSaved(false);
		setMessage(null);
		try {
			const res = await fetch("/api/auth/update-profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					full_name: profile.full_name, phone: profile.phone,
					default_location: profile.default_location,
					default_lat: profile.default_lat, default_lng: profile.default_lng,
					notification_email: profile.notification_email,
					notification_sms: profile.notification_sms,
					notification_storm_alerts: profile.notification_storm_alerts,
				}),
			});
			if (res.ok) {
				setSaved(true);
				setMessage({ type: "success", text: "Profile updated successfully" });
				setTimeout(() => setSaved(false), 3000);
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to update profile" });
			}
		} catch {
			setMessage({ type: "error", text: "Failed to update profile" });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="max-w-2xl space-y-5 animate-fade-in">
				<div className="flex justify-between"><div className="skeleton h-7 w-40 rounded-lg" /><div className="skeleton h-10 w-36 rounded-xl" /></div>
				{[1, 2].map((i) => (
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
					<h1 className="text-lg font-bold text-white">Profile Settings</h1>
					<p className="text-2xs text-storm-subtle mt-0.5">Manage your personal information and preferences</p>
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

			{/* Personal Information */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-storm-purple/15">
							<User className="h-4 w-4 text-storm-glow" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Personal Information</h2>
							<p className="text-2xs text-storm-subtle">Your account details</p>
						</div>
					</div>
					<div className="space-y-3">
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Full Name</label>
							<input type="text" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="dashboard-input" placeholder="Your name" />
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Email</label>
							<input type="email" value={profile.email} disabled className="dashboard-input opacity-50 cursor-not-allowed" />
							<p className="text-2xs text-storm-subtle mt-1">Email cannot be changed here. Contact support to update.</p>
						</div>
						<div>
							<label className="block text-2xs text-storm-subtle uppercase tracking-wider mb-1.5 font-medium">Phone Number</label>
							<input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="dashboard-input" placeholder="(555) 123-4567" />
						</div>
					</div>
				</div>
			</section>

			{/* Default Location */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
							<MapPin className="h-4 w-4 text-blue-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Default Location</h2>
							<p className="text-2xs text-storm-subtle">Used as the default center for Storm Ops, dashboard, and route planning</p>
						</div>
					</div>
					<div className="flex gap-2">
						<input type="text" value={profile.default_location} onChange={(e) => setProfile({ ...profile, default_location: e.target.value })} className="dashboard-input flex-1" placeholder="City, State or ZIP code" />
						<button type="button" onClick={useCurrentLocation} disabled={geoLoading} className="button-secondary flex items-center gap-2 text-sm whitespace-nowrap">
							{geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
							{geoLoading ? "Getting..." : "Use Current"}
						</button>
					</div>
					{geoError && <p className="text-xs text-amber-400">{geoError}</p>}
					{profile.default_lat && profile.default_lng && (
						<p className="text-2xs text-storm-subtle">Coordinates: {profile.default_lat.toFixed(4)}, {profile.default_lng.toFixed(4)}</p>
					)}
				</div>
			</section>

			{/* Notification Preferences */}
			<section className="storm-card overflow-hidden">
				<div className="glow-line" />
				<div className="p-5 space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
							<Bell className="h-4 w-4 text-emerald-400" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
							<p className="text-2xs text-storm-subtle">Control how you receive updates</p>
						</div>
					</div>
					<div className="space-y-2">
						<Toggle checked={profile.notification_email} onChange={(v) => setProfile({ ...profile, notification_email: v })} label="Email Notifications" description="Receive updates and reports via email" />
						<Toggle checked={profile.notification_sms} onChange={(v) => setProfile({ ...profile, notification_sms: v })} label="SMS Notifications" description="Receive text alerts for urgent storms" />
						<Toggle checked={profile.notification_storm_alerts} onChange={(v) => setProfile({ ...profile, notification_storm_alerts: v })} label="Storm Alerts" description="Get notified when storms hit your territories" />
					</div>
				</div>
			</section>
		</div>
	);
}
