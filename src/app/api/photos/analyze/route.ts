import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

export const runtime = "nodejs";

interface PhotoAnalysisResult {
	damageTypes: string[];
	severity: "none" | "minor" | "moderate" | "severe";
	confidenceScore: number;
	description: string;
	recommendations: string[];
	insuranceRelevant: boolean;
}

function getOpenAIClient() {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("Missing OPENAI_API_KEY");
	}
	return new OpenAI({ apiKey });
}

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access - Pro+ only
		const access = await checkFeatureAccess(user.id, "photo_analysis");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const formData = await request.formData();
		const file = formData.get("photo") as File | null;
		const reportId = formData.get("reportId") as string | null;

		if (!file) {
			return NextResponse.json({ error: "No photo provided" }, { status: 400 });
		}

		// Validate file type
		const validTypes = ["image/jpeg", "image/png", "image/webp"];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json(
				{ error: "Invalid file type. Please upload JPEG, PNG, or WebP" },
				{ status: 400 }
			);
		}

		// Validate file size (10MB max)
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			return NextResponse.json(
				{ error: "File size must be less than 10MB" },
				{ status: 400 }
			);
		}

		// Convert to base64 for OpenAI
		const bytes = await file.arrayBuffer();
		const base64 = Buffer.from(bytes).toString("base64");
		const dataUrl = `data:${file.type};base64,${base64}`;

		// Upload to Supabase Storage
		const fileName = `${user.id}/${Date.now()}-${file.name}`;
		const { error: uploadError } = await supabase.storage
			.from("roof-photos")
			.upload(fileName, file, {
				contentType: file.type,
				upsert: false
			});

		if (uploadError) {
			console.error("Storage upload error:", uploadError);
			// Continue anyway - we can still analyze the image
		}

		// Get public URL
		const { data: urlData } = supabase.storage
			.from("roof-photos")
			.getPublicUrl(fileName);

		// Analyze with OpenAI Vision
		const openai = getOpenAIClient();

		const completion = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{
					role: "system",
					content: `You are an expert roofing damage analyst. Analyze the provided roof photo and identify any damage.
					
Return your analysis as a JSON object with the following structure:
{
  "damageTypes": ["list", "of", "damage", "types"],
  "severity": "none" | "minor" | "moderate" | "severe",
  "confidenceScore": 0.0-1.0,
  "description": "Detailed description of damage observed",
  "recommendations": ["list", "of", "recommendations"],
  "insuranceRelevant": true/false
}

Damage types to look for:
- Hail damage (dents, bruising)
- Wind damage (lifted, missing, or torn shingles)
- Storm damage (debris impact)
- Water damage (staining, algae, moss)
- Aging/wear (curling, cracking, granule loss)
- Structural issues (sagging, exposed decking)
- Flashing damage
- Gutter damage

Be professional and precise. Insurance adjusters will review this analysis.`
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Analyze this roof photo for damage and provide your assessment."
						},
						{
							type: "image_url",
							image_url: {
								url: dataUrl,
								detail: "high"
							}
						}
					]
				}
			],
			max_tokens: 1000,
			response_format: { type: "json_object" }
		});

		const analysisText = completion.choices[0]?.message?.content;
		if (!analysisText) {
			throw new Error("No analysis received from AI");
		}

		const analysis: PhotoAnalysisResult = JSON.parse(analysisText);

		// Save to database
		const { data: photoRecord, error: dbError } = await (supabase
			.from("roof_photos") as any)
			.insert({
				user_id: user.id,
				report_id: reportId || null,
				photo_url: urlData.publicUrl || "",
				storage_path: fileName,
				analysis: analysis as unknown as Record<string, unknown>,
				damage_types: analysis.damageTypes,
				confidence_score: analysis.confidenceScore
			})
			.select()
			.single();

		if (dbError) {
			console.error("Database error:", dbError);
			// Return analysis anyway
		}

		return NextResponse.json({
			success: true,
			photoId: photoRecord?.id,
			photoUrl: urlData.publicUrl,
			analysis
		});
	} catch (error) {
		console.error("Photo analysis error:", error);
		return NextResponse.json(
			{ error: "Failed to analyze photo" },
			{ status: 500 }
		);
	}
}
