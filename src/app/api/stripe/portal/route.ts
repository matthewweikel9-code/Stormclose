import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripeConfig } from "@/lib/stripe/config";

export const runtime = "nodejs";

function normalizeBaseUrl(url: string) {
	return url.replace(/\/$/, "");
}

function getRequestOrigin(request: Request) {
	const forwardedProto = request.headers.get("x-forwarded-proto");
	const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

	if (forwardedProto && forwardedHost) {
		return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
	}

	return normalizeBaseUrl(new URL(request.url).origin);
}

export async function POST(request: Request) {
	if (!stripeConfig.secretKey) {
		return NextResponse.json(
			{ error: "Stripe is not configured. Missing STRIPE_SECRET_KEY." },
			{ status: 500 }
		);
	}

	const supabase = await createClient();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { data: userRecord } = (await supabase
		.from("users")
		.select("stripe_customer_id")
		.eq("id", user.id)
		.maybeSingle()) as { data: { stripe_customer_id: string | null } | null };

	if (!userRecord?.stripe_customer_id) {
		return NextResponse.json(
			{ error: "No subscription found. Please subscribe first." },
			{ status: 400 }
		);
	}

	const stripe = new Stripe(stripeConfig.secretKey, {
		apiVersion: "2024-06-20"
	});

	const returnUrl = `${getRequestOrigin(request)}/dashboard`;

	const portalSession = await stripe.billingPortal.sessions.create({
		customer: userRecord.stripe_customer_id,
		return_url: returnUrl
	});

	if (!portalSession.url) {
		return NextResponse.json(
			{ error: "Failed to create portal session" },
			{ status: 500 }
		);
	}

	return NextResponse.json({ url: portalSession.url });
}
