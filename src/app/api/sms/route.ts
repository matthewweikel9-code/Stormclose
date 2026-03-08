import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

interface SMSRequest {
	message: string;
	conversationHistory?: Array<{
		role: "homeowner" | "assistant";
		content: string;
	}>;
	context?: {
		businessName?: string;
		ownerName?: string;
		services?: string[];
	};
}

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "sms_responder");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as SMSRequest;
		const { message, conversationHistory = [], context = {} } = body;

		if (!message) {
			return NextResponse.json(
				{ error: "No message provided" },
				{ status: 400 }
			);
		}

		const { businessName = "our roofing company", ownerName, services = ["roofing", "storm damage repair", "insurance claims"] } = context;

		const systemPrompt = `You are a helpful AI assistant responding to text messages for ${businessName}, a professional roofing company.

Your goals:
1. Respond naturally and conversationally (these are SMS texts)
2. Answer common questions about roofing services
3. Qualify leads by understanding their situation
4. Book appointments when appropriate
5. Collect contact information when needed
6. Be helpful but keep responses SMS-appropriate (concise)

Key information:
- Company: ${businessName}
${ownerName ? `- Owner/Contact: ${ownerName}` : ""}
- Services: ${services.join(", ")}
- You can schedule free inspections
- You work with all insurance companies
- You're available for emergency storm damage

Response guidelines:
- Keep responses under 160 characters when possible (SMS limit)
- Use natural, friendly language
- If they're ready to schedule, offer available times
- Ask qualifying questions one at a time
- If uncertain, offer to have someone call them back`;

		// Build conversation for OpenAI
		const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
			{ role: "system", content: systemPrompt },
		];

		// Add conversation history
		for (const msg of conversationHistory) {
			messages.push({
				role: msg.role === "homeowner" ? "user" : "assistant",
				content: msg.content,
			});
		}

		// Add the new message
		messages.push({ role: "user", content: message });

		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages,
			temperature: 0.7,
			max_tokens: 300,
		});

		const response = completion.choices[0]?.message?.content;

		if (!response) {
			return NextResponse.json(
				{ error: "Failed to generate response" },
				{ status: 500 }
			);
		}

		// Detect intent from the conversation
		const intentKeywords = {
			scheduling: ["schedule", "appointment", "come out", "when", "available", "book"],
			pricing: ["cost", "price", "how much", "estimate", "quote"],
			emergency: ["emergency", "urgent", "leak", "flooding", "water"],
			insurance: ["insurance", "claim", "adjuster", "coverage"],
		};

		let detectedIntent = "general";
		const lowerMessage = message.toLowerCase();
		for (const [intent, keywords] of Object.entries(intentKeywords)) {
			if (keywords.some(kw => lowerMessage.includes(kw))) {
				detectedIntent = intent;
				break;
			}
		}

		// Log usage
		await (supabase.from("feature_usage") as any).insert({
			user_id: user.id,
			feature: "sms_responder",
			metadata: { intent: detectedIntent },
		});

		return NextResponse.json({
			success: true,
			response,
			metadata: {
				intent: detectedIntent,
				characterCount: response.length,
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error) {
		console.error("SMS response error:", error);
		return NextResponse.json(
			{ error: "Failed to generate response" },
			{ status: 500 }
		);
	}
}
