/**
 * Supabase-backed rate limiter for API routes.
 * Limits are per-user, per-endpoint, per time window.
 */

const AI_LIMIT_PER_HOUR = 60;
const EXPORT_LIMIT_PER_HOUR = 50;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function bucketKey(endpoint: string): string {
  const hour = Math.floor(Date.now() / WINDOW_MS);
  return `${endpoint}:${hour}`;
}

export async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  endpoint: "ai" | "export"
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const limit = endpoint === "ai" ? AI_LIMIT_PER_HOUR : EXPORT_LIMIT_PER_HOUR;
  const key = bucketKey(endpoint);

  const { data: rows, error } = await supabase
    .from("rate_limit_log")
    .select("id")
    .eq("user_id", userId)
    .eq("bucket_key", key);

  if (error) {
    // On DB error, allow the request (fail open to avoid blocking users)
    return { allowed: true, remaining: limit };
  }

  const count = rows?.length ?? 0;
  if (count >= limit) {
    const windowEnd = (Math.floor(Date.now() / WINDOW_MS) + 1) * WINDOW_MS;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((windowEnd - Date.now()) / 1000),
    };
  }

  await supabase.from("rate_limit_log").insert({
    user_id: userId,
    bucket_key: key,
    created_at: new Date().toISOString(),
  });

  return { allowed: true, remaining: limit - count - 1 };
}
