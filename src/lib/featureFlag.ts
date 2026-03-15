import { createClient } from "@/lib/supabase/server";

function parseEnvBoolean(value: string | undefined): boolean | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return null;
}

export async function isFeatureEnabled(userId: string, key: string): Promise<boolean> {
	if (!userId || !key) return true;

	const normalizedKey = key.trim().toLowerCase();
	const envKey = `FEATURE_FLAG_${normalizedKey.replace(/\./g, "_").toUpperCase()}`;
	const envOverride = parseEnvBoolean(process.env[envKey]);
	if (envOverride !== null) return envOverride;

	if (process.env.NODE_ENV === "test") return true;

	try {
		const supabase = await createClient();

		const { data: userFlag } = await (supabase.from("feature_flags") as any)
			.select("enabled")
			.eq("key", normalizedKey)
			.eq("user_id", userId)
			.maybeSingle();
		if (userFlag && typeof userFlag.enabled === "boolean") {
			return userFlag.enabled;
		}

		const { data: globalFlag } = await (supabase.from("feature_flags") as any)
			.select("enabled")
			.eq("key", normalizedKey)
			.is("user_id", null)
			.maybeSingle();
		if (globalFlag && typeof globalFlag.enabled === "boolean") {
			return globalFlag.enabled;
		}
	} catch {
		return true;
	}

	return true;
}
