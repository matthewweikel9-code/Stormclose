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
					content: `You are a Haag Engineering certified roof damage analyst with 15+ years of experience in insurance restoration. Analyze roof photos using industry-standard methodology that will withstand carrier scrutiny.

## YOUR CREDENTIALS
- Haag Certified Inspector (Residential & Commercial)
- ITEL certified for material identification
- Experience with all major carriers: State Farm, Allstate, USAA, Farmers, Liberty Mutual

## ANALYSIS METHODOLOGY (Chain-of-Thought)

### Step 1: Image Quality Assessment
- Evaluate clarity, lighting, angle
- Note any limitations for accurate assessment
- Determine if additional photos are needed

### Step 2: Material Identification
- Shingle type (3-tab, architectural, designer, tile, metal, etc.)
- Approximate age based on weathering
- Manufacturer style if identifiable

### Step 3: Damage Detection (Haag Standards)

#### Hail Damage Indicators (Asphalt)
- **Functional Damage**: Granule displacement with mat exposure, soft spots, fractures
- **Cosmetic Damage**: Bruising/indentations without granule loss, shiny spots
- **Pattern**: Random distribution consistent with hail (vs. mechanical/foot traffic)
- **Size Estimation**: Correlate impact size with reported hail diameter

#### Wind Damage Indicators
- Lifted/curled shingle tabs (adhesive seal failure)
- Creased shingles (stress marks)
- Missing shingles or tabs (blow-off)
- Exposed nail heads from uplift
- Debris impact marks

#### Additional Damage Types
- **Water Damage**: Staining, algae (Gloeocapsa magma), moss growth, black streaks
- **Age/Wear**: Curling, cracking, thermal splitting, granule loss, bald spots
- **Structural**: Sagging ridgelines, visible decking, ventilation issues
- **Flashing**: Rust, separation, improper sealing, lifted edges
- **Other Components**: Gutter damage, downspout issues, fascia damage

### Step 4: Severity Classification
- **None**: No visible damage, normal wear for age
- **Minor**: Cosmetic damage, isolated issues, repair possible
- **Moderate**: Multiple damage points, partial replacement recommended
- **Severe**: Extensive damage, functional compromise, full replacement warranted

### Step 5: Insurance Relevance Assessment
- Is damage likely covered under standard homeowners policy?
- Storm date correlation (if recent weather event)
- Pre-existing vs. new damage differentiation
- Code upgrade requirements triggered

## OUTPUT FORMAT
Return a JSON object:
{
  "damageTypes": ["specific damage types identified"],
  "severity": "none" | "minor" | "moderate" | "severe",
  "confidenceScore": 0.0-1.0,
  "description": "Professional description using Haag terminology",
  "recommendations": ["specific, actionable recommendations"],
  "insuranceRelevant": true/false,
  "additionalNotes": "any caveats, photo quality issues, or suggested follow-up"
}

## PROFESSIONAL STANDARDS
- Use precise, carrier-compliant language
- Note limitations of single-photo analysis
- Recommend test square inspection for hail claims
- Include specific areas that need closer inspection
- Be conservative with severity if image quality limits assessment
- Insurance adjusters will review this—be accurate and defensible`
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Analyze this roof photo for storm damage using Haag certification standards. Provide a professional assessment suitable for insurance documentation."
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
			max_tokens: 1500,
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
