import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

const GOOGLE_API_KEY = process.env.GOOGLE_SOLAR_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Google Cloud Vision API for OCR
async function extractTextFromImage(imageBase64: string): Promise<string> {
	const response = await fetch(
		`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requests: [
					{
						image: { content: imageBase64 },
						features: [
							{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }
						]
					}
				]
			})
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || "Vision API failed");
	}

	const data = await response.json();
	const textAnnotations = data.responses?.[0]?.fullTextAnnotation;
	
	if (!textAnnotations) {
		throw new Error("No text found in image");
	}

	return textAnnotations.text;
}

// Parse extracted text with OpenAI to structure the data
async function parseEstimateText(rawText: string): Promise<{
	lineItems: Array<{
		code: string;
		description: string;
		quantity: string;
		unit: string;
		unitCost: string;
		total: string;
	}>;
	summary: {
		subtotal: string;
		overhead: string;
		profit: string;
		total: string;
		rcv: string;
		depreciation: string;
		acv: string;
	};
	claimInfo: {
		claimNumber: string;
		insured: string;
		dateOfLoss: string;
		carrier: string;
		adjuster: string;
	};
}> {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${OPENAI_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4o",
			messages: [
				{
					role: "system",
					content: `You are an expert at parsing Xactimate insurance estimates. Extract structured data from the raw OCR text.

Return a JSON object with this exact structure:
{
  "lineItems": [
    {
      "code": "Xactimate code like RFG LAMI",
      "description": "Full description",
      "quantity": "numeric quantity",
      "unit": "SF, LF, EA, etc",
      "unitCost": "price per unit",
      "total": "line total"
    }
  ],
  "summary": {
    "subtotal": "subtotal amount",
    "overhead": "O&P overhead if listed",
    "profit": "O&P profit if listed",
    "total": "grand total",
    "rcv": "replacement cost value",
    "depreciation": "depreciation amount",
    "acv": "actual cash value"
  },
  "claimInfo": {
    "claimNumber": "claim/file number",
    "insured": "property owner name",
    "dateOfLoss": "date of loss/damage",
    "carrier": "insurance company name",
    "adjuster": "adjuster name if listed"
  }
}

If a field cannot be found, use "N/A". Always return valid JSON.`
				},
				{
					role: "user",
					content: `Parse this Xactimate estimate OCR text:\n\n${rawText}`
				}
			],
			temperature: 0.1,
			response_format: { type: "json_object" }
		})
	});

	if (!response.ok) {
		throw new Error("Failed to parse estimate");
	}

	const data = await response.json();
	return JSON.parse(data.choices[0].message.content);
}

export async function POST(request: NextRequest) {
	try {
		// Check authentication
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access (enterprise only)
		const access = await checkFeatureAccess(user.id, "supplement_generator");

		if (!access.allowed) {
			return NextResponse.json({
				error: "Feature not available",
				reason: access.reason,
				tier: access.tier
			}, { status: 403 });
		}

		const body = await request.json();
		const { imageBase64, imageUrl } = body;

		if (!imageBase64 && !imageUrl) {
			return NextResponse.json(
				{ error: "Image data required (base64 or URL)" },
				{ status: 400 }
			);
		}

		let base64Data = imageBase64;

		// If URL provided, fetch and convert to base64
		if (imageUrl && !imageBase64) {
			const imageResponse = await fetch(imageUrl);
			const buffer = await imageResponse.arrayBuffer();
			base64Data = Buffer.from(buffer).toString("base64");
		}

		// Remove data URL prefix if present
		if (base64Data.includes("base64,")) {
			base64Data = base64Data.split("base64,")[1];
		}

		// Step 1: Extract text using Google Vision
		const rawText = await extractTextFromImage(base64Data);

		// Step 2: Parse with OpenAI
		const parsed = await parseEstimateText(rawText);

		return NextResponse.json({
			success: true,
			rawText: rawText.substring(0, 500) + "...", // Preview of raw text
			parsed,
			lineItemCount: parsed.lineItems.length
		});

	} catch (error) {
		console.error("Estimate OCR error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to process estimate" },
			{ status: 500 }
		);
	}
}
