import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
	companyName: z.string().min(1, "Company name is required"),
	contactName: z.string().min(1, "Contact name is required"),
	email: z.string().email("Valid email is required"),
	phone: z.string().optional(),
	message: z.string().optional(),
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.DEMO_REQUEST_EMAIL || "support@stormclose.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "StormClose <noreply@stormclose.com>";

async function storeInSupabase(data: {
	companyName: string;
	contactName: string;
	email: string;
	phone?: string;
	message?: string;
}): Promise<boolean> {
	try {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) return false;

		const supabase = createClient(url, key);
		const { error } = await supabase.from("demo_requests").insert({
			company_name: data.companyName,
			contact_name: data.contactName,
			email: data.email,
			phone: data.phone ?? null,
			message: data.message ?? null,
		});
		return !error;
	} catch {
		return false;
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			const msg = parsed.error.errors[0]?.message ?? "Invalid input";
			return NextResponse.json({ error: msg }, { status: 400 });
		}

		const { companyName, contactName, email, phone, message } = parsed.data;
		let emailSent = false;

		if (RESEND_API_KEY) {
			const resend = new Resend(RESEND_API_KEY);
			const { error } = await resend.emails.send({
				from: FROM_EMAIL,
				to: TO_EMAIL,
				subject: `Demo Request: ${companyName}`,
				html: `
					<h2>New Demo Request</h2>
					<p><strong>Company:</strong> ${companyName}</p>
					<p><strong>Contact:</strong> ${contactName}</p>
					<p><strong>Email:</strong> ${email}</p>
					<p><strong>Phone:</strong> ${phone ?? "—"}</p>
					${message ? `<p><strong>Message:</strong><br/>${message}</p>` : ""}
				`,
			});
			if (!error) emailSent = true;
			else console.error("[Demo Request] Resend error:", error);
		} else {
			console.warn("[Demo Request] RESEND_API_KEY not configured");
		}

		// Fallback: store in Supabase so you never lose a lead
		const stored = await storeInSupabase({ companyName, contactName, email, phone, message });

		if (emailSent || stored) {
			return NextResponse.json({ success: true });
		}

		return NextResponse.json(
			{ error: "Could not save your request. Please email support@stormclose.com directly." },
			{ status: 500 }
		);
	} catch (e) {
		console.error("[Demo Request]", e);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
