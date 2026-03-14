import { createClient } from "@/lib/supabase/server";

function normalizeFlagKey(key: string): string {
  return key.trim().toLowerCase();
}

function parseEnvBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

/**
 * Returns whether a feature flag is enabled for the current user context.
 *
 * Resolution order:
 * 1) Environment override via FEATURE_FLAG_<KEY>
 * 2) Per-user row in feature_flags
 * 3) Global row in feature_flags (user_id IS NULL)
 * 4) false (default)
 */
export async function isFeatureEnabled(
  userId: string | null | undefined,
  key: string
): Promise<boolean> {
  if (typeof key !== "string" || key.trim().length === 0) {
    return false;
  }

  const normalizedKey = normalizeFlagKey(key);
  const envKey = `FEATURE_FLAG_${normalizedKey.toUpperCase()}`;
  const envOverride = parseEnvBoolean(process.env[envKey]);
  if (envOverride !== null) {
    return envOverride;
  }

  const supabase = await createClient();

  try {
    if (typeof userId === "string" && userId.trim().length > 0) {
      const { data: userFlag, error: userErr } = await (supabase.from("feature_flags") as any)
        .select("enabled")
        .eq("key", normalizedKey)
        .eq("user_id", userId)
        .maybeSingle();

      if (!userErr && userFlag && typeof userFlag.enabled === "boolean") {
        return userFlag.enabled;
      }
    }

    const { data: globalFlag, error: globalErr } = await (supabase.from("feature_flags") as any)
      .select("enabled")
      .eq("key", normalizedKey)
      .is("user_id", null)
      .maybeSingle();

    if (!globalErr && globalFlag && typeof globalFlag.enabled === "boolean") {
      return globalFlag.enabled;
    }
  } catch (error) {
    console.error("[FeatureFlag] Lookup failed:", error);
  }

  return false;
}
