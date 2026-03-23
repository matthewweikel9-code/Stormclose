import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { normalizeUserRole, type UserRole } from "@/lib/auth/roles";
import {
	API_ROLE_RULES,
	PAGE_ROLE_RULES,
	hasRoleAccess,
	isPublicApiPath,
} from "@/lib/auth/access-control";
import { checkRateLimit } from "@/lib/rate-limit";

function parseEnvBoolean(value: string | undefined): boolean | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) return true;
	if (["0", "false", "no", "off"].includes(normalized)) return false;
	return null;
}

async function getUserRole(supabase: Awaited<ReturnType<typeof updateSession>>["supabase"], user: { id: string; user_metadata?: Record<string, unknown> }): Promise<UserRole> {
	try {
		const { data: row } = (await (supabase.from("users") as any)
			.select("role")
			.eq("id", user.id)
			.maybeSingle()) as { data: { role?: string | null } | null };
		const roleFromProfile = typeof row?.role === "string" ? row.role : null;
		const roleFromMetadata = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
		return normalizeUserRole(roleFromProfile ?? roleFromMetadata);
	} catch {
		const roleFromMetadata = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null;
		return normalizeUserRole(roleFromMetadata);
	}
}

async function isFeatureEnabledForRequest(
	supabase: Awaited<ReturnType<typeof updateSession>>["supabase"],
	userId: string,
	key: string
): Promise<boolean> {
	const normalizedKey = key.trim().toLowerCase();
	const envKey = `FEATURE_FLAG_${normalizedKey.replace(/\./g, "_").toUpperCase()}`;
	const envOverride = parseEnvBoolean(process.env[envKey]);
	if (envOverride !== null) return envOverride;

	try {
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

function resolveAiModuleFlag(pathname: string): string {
	const segment = pathname.split("/").filter(Boolean).pop() ?? "";
	if (!segment) return "ai.enabled";
	return `ai.${segment.replace(/-/g, "_")}.enabled`;
}

export async function middleware(request: NextRequest) {
	const { response, supabase, user } = await updateSession(request);
	const pathname = request.nextUrl.pathname;
	const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`;

	const isApiRoute = pathname.startsWith("/api/");
	const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
	const isSettingsRoute = pathname === "/settings" || pathname.startsWith("/settings/");
	const isProtectedPageRoute = isDashboardRoute || isSettingsRoute;
	const isDeprecatedStormOpsRoute =
		pathname === "/dashboard/command-center" ||
		pathname.startsWith("/dashboard/command-center/") ||
		pathname === "/dashboard/leads" ||
		pathname.startsWith("/dashboard/leads/") ||
		pathname === "/dashboard/route-planner" ||
		pathname.startsWith("/dashboard/route-planner/");

	if (isApiRoute) {
		if (isPublicApiPath(pathname)) {
			return response;
		}

		if (!user) {
			return NextResponse.json({ data: null, error: "Unauthorized", meta: {} }, { status: 401 });
		}

		const userRole = await getUserRole(supabase, user);
		if (!hasRoleAccess(pathname, userRole, API_ROLE_RULES)) {
			return NextResponse.json({ data: null, error: "Forbidden", meta: {} }, { status: 403 });
		}

		if (pathname.startsWith("/api/ai/")) {
			const rateLimit = await checkRateLimit(supabase, user.id, "ai");
			if (!rateLimit.allowed) {
				const headers: Record<string, string> = { "X-RateLimit-Remaining": "0" };
				if (rateLimit.retryAfter) headers["Retry-After"] = String(rateLimit.retryAfter);
				return NextResponse.json(
					{ data: null, error: "AI rate limit exceeded (60/hour). Try again later.", meta: {} },
					{ status: 429, headers }
				);
			}

			const aiEnabled = await isFeatureEnabledForRequest(supabase, user.id, "ai.enabled");
			if (!aiEnabled) {
				return NextResponse.json(
					{ data: null, error: "AI is temporarily disabled", meta: {} },
					{ status: 503 }
				);
			}

			const moduleFlag = resolveAiModuleFlag(pathname);
			const moduleEnabled = await isFeatureEnabledForRequest(supabase, user.id, moduleFlag);
			if (!moduleEnabled) {
				return NextResponse.json(
					{ data: null, error: "This AI module is disabled", meta: { flag: moduleFlag } },
					{ status: 503 }
				);
			}
		}

		if (pathname.startsWith("/api/exports/")) {
			const exportsEnabled = await isFeatureEnabledForRequest(supabase, user.id, "exports.enabled");
			if (!exportsEnabled) {
				return NextResponse.json(
					{ data: null, error: "Exports are temporarily disabled", meta: {} },
					{ status: 503 }
				);
			}
		}

		return response;
	}

	if (isDeprecatedStormOpsRoute) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/dashboard/storm-map";
		return NextResponse.redirect(redirectUrl);
	}

	if (!isProtectedPageRoute) {
		return response;
	}

	if (!user) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/login";
		redirectUrl.searchParams.set("next", pathWithQuery);
		return NextResponse.redirect(redirectUrl);
	}

	const userRole = await getUserRole(supabase, user);
	if (!hasRoleAccess(pathname, userRole, PAGE_ROLE_RULES)) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/dashboard";
		redirectUrl.searchParams.set("error", "forbidden");
		return NextResponse.redirect(redirectUrl);
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
