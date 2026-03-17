"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function ProfileSettingsPage() {
	const [profile, setProfile] = useState<ProfileData>({
		full_name: "",
		email: "",
		phone: "",
		default_location: "",
		default_lat: null,
		default_lng: null,
		notification_email: true,
		notification_sms: false,
		notification_storm_alerts: true,
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
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
		setMessage(null);
		try {
			const res = await fetch("/api/auth/update-profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					full_name: profile.full_name,
					phone: profile.phone,
					default_location: profile.default_location,
					default_lat: profile.default_lat,
					default_lng: profile.default_lng,
					notification_email: profile.notification_email,
					notification_sms: profile.notification_sms,
					notification_storm_alerts: profile.notification_storm_alerts,
				}),
			});

			if (res.ok) {
				setMessage({ type: "success", text: "Profile updated successfully" });
			} else {
				const data = await res.json();
				setMessage({ type: "error", text: data.error || "Failed to update profile" });
			}
		} catch (error) {
			setMessage({ type: "error", text: "Failed to update profile" });
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
				<h1 className="text-2xl font-bold">Profile Settings</h1>
				<p className="text-zinc-400 text-sm mt-1">Manage your personal information and preferences</p>
			</div>

			{message && (
				<div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-red-500/20 text-red-400 border border-red-500/50"}`}>
					{message.text}
				</div>
			)}

			{/* Personal Information */}
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">Personal Information</h2>
				<div className="space-y-4">
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Full Name</label>
						<input
							type="text"
							value={profile.full_name}
							onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="Your name"
						/>
					</div>
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Email</label>
						<input
							type="email"
							value={profile.email}
							disabled
							className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-500 cursor-not-allowed"
						/>
						<p className="text-xs text-zinc-500 mt-1">Email cannot be changed here. Contact support to update.</p>
					</div>
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Phone Number</label>
						<input
							type="tel"
							value={profile.phone}
							onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
							className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
							placeholder="(555) 123-4567"
						/>
					</div>
					<div>
						<label className="block text-sm text-zinc-400 mb-1">Default Location</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={profile.default_location}
								onChange={(e) => setProfile({ ...profile, default_location: e.target.value })}
								className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
								placeholder="City, State or ZIP code"
							/>
							<button
								type="button"
								onClick={useCurrentLocation}
								disabled={geoLoading}
								className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg font-medium text-sm whitespace-nowrap flex items-center gap-2"
							>
								{geoLoading ? (
									<>
										<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
										Getting...
									</>
								) : (
									<>📍 Use current location</>
								)}
							</button>
						</div>
						{geoError && <p className="text-xs text-amber-400 mt-1">{geoError}</p>}
						<p className="text-xs text-zinc-500 mt-1">Used as the default center for Storm Ops, dashboard, and route planning. If browser geolocation fails, set a default here.</p>
					</div>
				</div>
			</div>

			{/* Notification Preferences */}
			<div className="bg-zinc-800 rounded-xl p-6 mb-6">
				<h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
				<div className="space-y-4">
					<label className="flex items-center justify-between cursor-pointer">
						<div>
							<div className="font-medium text-sm">Email Notifications</div>
							<div className="text-xs text-zinc-500">Receive updates and reports via email</div>
						</div>
						<div className={`relative w-11 h-6 rounded-full transition-colors ${profile.notification_email ? "bg-blue-600" : "bg-zinc-600"}`} onClick={() => setProfile({ ...profile, notification_email: !profile.notification_email })}>
							<div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.notification_email ? "translate-x-5" : ""}`} />
						</div>
					</label>
					<label className="flex items-center justify-between cursor-pointer">
						<div>
							<div className="font-medium text-sm">SMS Notifications</div>
							<div className="text-xs text-zinc-500">Receive text alerts for urgent storms</div>
						</div>
						<div className={`relative w-11 h-6 rounded-full transition-colors ${profile.notification_sms ? "bg-blue-600" : "bg-zinc-600"}`} onClick={() => setProfile({ ...profile, notification_sms: !profile.notification_sms })}>
							<div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.notification_sms ? "translate-x-5" : ""}`} />
						</div>
					</label>
					<label className="flex items-center justify-between cursor-pointer">
						<div>
							<div className="font-medium text-sm">Storm Alerts</div>
							<div className="text-xs text-zinc-500">Get notified when storms hit your territories</div>
						</div>
						<div className={`relative w-11 h-6 rounded-full transition-colors ${profile.notification_storm_alerts ? "bg-blue-600" : "bg-zinc-600"}`} onClick={() => setProfile({ ...profile, notification_storm_alerts: !profile.notification_storm_alerts })}>
							<div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.notification_storm_alerts ? "translate-x-5" : ""}`} />
						</div>
					</label>
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
