import { NextRequest } from "next/server";
import { handleNextRoute, withStatus } from "@/lib/api-middleware";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function parseAdminAllowList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isAllowedAdmin(userId: string, email?: string | null): boolean {
  const allowedIds = parseAdminAllowList(process.env.FEATURE_FLAG_ADMIN_USER_IDS);
  const allowedEmails = parseAdminAllowList(process.env.FEATURE_FLAG_ADMIN_EMAILS);

  if (allowedIds.size === 0 && allowedEmails.size === 0) {
    return false;
  }

  if (allowedIds.has(userId)) {
    return true;
  }

  if (email && allowedEmails.has(email.toLowerCase())) {
    return true;
  }

  return false;
}

async function upsertFlag(params: { key: string; enabled: boolean; userId: string | null }) {
  const admin = createAdminClient();

  let existingQuery = (admin.from("feature_flags") as any)
    .select("id")
    .eq("key", params.key)
    .limit(1);

  if (params.userId) {
    existingQuery = existingQuery.eq("user_id", params.userId);
  } else {
    existingQuery = existingQuery.is("user_id", null);
  }

  const { data: existing, error: selectError } = await existingQuery.maybeSingle();
  if (selectError) {
    throw selectError;
  }

  if (existing?.id) {
    const { data: updated, error: updateError } = await (admin.from("feature_flags") as any)
      .update({ enabled: params.enabled })
      .eq("id", existing.id)
      .select("id, key, user_id, enabled, created_at")
      .single();

    if (updateError) {
      throw updateError;
    }

    return updated;
  }

  const { data: inserted, error: insertError } = await (admin.from("feature_flags") as any)
    .insert({
      key: params.key,
      user_id: params.userId,
      enabled: params.enabled,
    })
    .select("id, key, user_id, enabled, created_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

export async function POST(request: NextRequest) {
  return handleNextRoute(
    request,
    async ({ setUserId }) => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id);

      if (!user) {
        return withStatus(401, { error: "Unauthorized" });
      }

      if (!isAllowedAdmin(user.id, user.email)) {
        return withStatus(403, { error: "Forbidden" });
      }

      let body: any;
      try {
        body = await request.json();
      } catch {
        return withStatus(400, { error: "Invalid JSON body" });
      }

      const key = normalizeKey(body?.key);
      const enabled = body?.enabled;
      const targetUserId = typeof body?.userId === "string" && body.userId.trim().length > 0
        ? body.userId.trim()
        : null;

      if (!key) {
        return withStatus(400, { error: "key is required" });
      }

      if (typeof enabled !== "boolean") {
        return withStatus(400, { error: "enabled must be a boolean" });
      }

      try {
        const flag = await upsertFlag({ key, enabled, userId: targetUserId });
        return {
          success: true,
          flag,
        };
      } catch (error) {
        return withStatus(500, {
          error: "Failed to upsert feature flag",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
    { route: "/api/admin/feature-flags" }
  );
}
