import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
	const { response, supabase, user } = await updateSession(request);
	const pathname = request.nextUrl.pathname;
	const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`;

	const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
	const isReportGenerationRoute =
		pathname === "/dashboard/report" || pathname.startsWith("/dashboard/report/");

	if (!isDashboardRoute) {
		return response;
	}

	if (!user) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/login";
		redirectUrl.searchParams.set("next", pathWithQuery);
		return NextResponse.redirect(redirectUrl);
	}

	if (!isReportGenerationRoute) {
		return response;
	}

	const { data: billingUser } = (await supabase
		.from("users")
		.select("subscription_status")
		.eq("id", user.id)
		.maybeSingle()) as { data: { subscription_status: string | null } | null };

	if (billingUser?.subscription_status !== "active") {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/pricing";
		redirectUrl.searchParams.set("next", pathWithQuery);
		return NextResponse.redirect(redirectUrl);
	}

	return response;
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
