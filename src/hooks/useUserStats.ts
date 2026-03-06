"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserStats {
	reports: number;
	followups: number;
	objections: number;
	photos: number;
	emails: number;
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

export function useUserStats(): UserStats {
	const [stats, setStats] = useState({
		reports: 0,
		followups: 0,
		objections: 0,
		photos: 0,
		emails: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchStats = async () => {
		setIsLoading(true);
		setError(null);

		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();

			if (!user) {
				setIsLoading(false);
				return;
			}

			// Fetch all counts in parallel
			const [
				reportsResult,
				followupsResult,
				objectionsResult,
				photosResult,
				emailsResult,
			] = await Promise.all([
				supabase
					.from("reports")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("followups")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("objections")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("roof_photos")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("email_drafts")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
			]);

			setStats({
				reports: reportsResult.count ?? 0,
				followups: followupsResult.count ?? 0,
				objections: objectionsResult.count ?? 0,
				photos: photosResult.count ?? 0,
				emails: emailsResult.count ?? 0,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch stats");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchStats();
	}, []);

	return {
		...stats,
		isLoading,
		error,
		refetch: fetchStats,
	};
}

// Individual hooks for specific counts
export function useReportCount() {
	const { reports, isLoading, error, refetch } = useUserStats();
	return { count: reports, isLoading, error, refetch };
}

export function useFollowupCount() {
	const { followups, isLoading, error, refetch } = useUserStats();
	return { count: followups, isLoading, error, refetch };
}

export function useObjectionCount() {
	const { objections, isLoading, error, refetch } = useUserStats();
	return { count: objections, isLoading, error, refetch };
}

export function usePhotoCount() {
	const { photos, isLoading, error, refetch } = useUserStats();
	return { count: photos, isLoading, error, refetch };
}

export function useEmailCount() {
	const { emails, isLoading, error, refetch } = useUserStats();
	return { count: emails, isLoading, error, refetch };
}
