import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoleForTeam } from "@/lib/server/tenant";
import OpenAI from "openai";

const supabaseAdmin = createAdminClient() as any;

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

async function userCanAccessLead(supabase: any, userId: string, leadId: string): Promise<boolean> {
	const { data: lead, error } = await (supabase.from("leads") as any)
		.select("id, user_id, team_id")
		.eq("id", leadId)
		.maybeSingle();

	if (error || !lead) {
		return false;
	}

	if (lead.user_id === userId) {
		return true;
	}

	if (lead.team_id) {
		const role = await getUserRoleForTeam(supabase, userId, lead.team_id);
		return Boolean(role);
	}

	return false;
}

// GET: Fetch voice notes for a lead or user
export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const leadId = searchParams.get("leadId");
	const limit = parseInt(searchParams.get("limit") || "20", 10);

	try {
		let query = (supabase.from("voice_notes") as any)
			.select(`
				id,
				lead_id,
				audio_url,
				duration_seconds,
				transcription,
				transcription_status,
				summary,
				action_items,
				sentiment,
				suggested_status,
				suggested_notes,
				created_at
			`)
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (leadId) {
			query = query.eq("lead_id", leadId);
		}

		const { data: voiceNotes, error } = await query;

		if (error) {
			console.error("Error fetching voice notes:", error);
			return NextResponse.json({ error: "Failed to fetch voice notes" }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			voiceNotes: voiceNotes || [],
		});
	} catch (error) {
		console.error("Voice notes fetch error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// POST: Create a new voice note and transcribe it
export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const audioFile = formData.get("audio") as File;
		const leadId = formData.get("leadId") as string;
		const duration = parseInt(formData.get("duration") as string || "0", 10);

		if (!audioFile) {
			return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
		}

		if (leadId) {
			const canAccessLead = await userCanAccessLead(supabase, user.id, leadId);
			if (!canAccessLead) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		// Upload audio to Supabase Storage
		const fileName = `voice-notes/${user.id}/${Date.now()}-${audioFile.name || "recording.webm"}`;
		const { error: uploadError } = await supabase.storage
			.from("media")
			.upload(fileName, audioFile, {
				contentType: audioFile.type || "audio/webm",
				upsert: false,
			});

		if (uploadError) {
			console.error("Upload error:", uploadError);
			return NextResponse.json({ error: "Failed to upload audio" }, { status: 500 });
		}

		// Get public URL
		const { data: urlData } = supabase.storage
			.from("media")
			.getPublicUrl(fileName);

		const audioUrl = urlData.publicUrl;

		// Create voice note record
		const { data: voiceNote, error: insertError } = await (supabase.from("voice_notes") as any)
			.insert({
				user_id: user.id,
				lead_id: leadId || null,
				audio_url: audioUrl,
				duration_seconds: duration,
				transcription_status: "processing",
			})
			.select()
			.single();

		if (insertError) {
			console.error("Insert error:", insertError);
			return NextResponse.json({ error: "Failed to create voice note" }, { status: 500 });
		}

		// Transcribe in background (don't await)
		transcribeAndAnalyze(voiceNote.id, audioFile, leadId || null, user.id).catch(console.error);

		return NextResponse.json({
			success: true,
			voiceNote: {
				id: voiceNote.id,
				audio_url: audioUrl,
				transcription_status: "processing",
			},
		});
	} catch (error) {
		console.error("Voice note creation error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

async function transcribeAndAnalyze(
	voiceNoteId: string,
	audioFile: File,
	leadId: string | null,
	userId: string
) {
	try {
		// Convert File to buffer for OpenAI
		const buffer = Buffer.from(await audioFile.arrayBuffer());
		
		// Create a temporary file-like object for OpenAI
		const file = new File([buffer], audioFile.name || "audio.webm", {
			type: audioFile.type || "audio/webm",
		});

		// Transcribe with Whisper
		const transcription = await openai.audio.transcriptions.create({
			file: file,
			model: "whisper-1",
			language: "en",
		});

		const transcriptionText = transcription.text;

		// Analyze the transcription with GPT
		let analysis = {
			summary: "",
			action_items: [] as string[],
			sentiment: "neutral" as "positive" | "neutral" | "negative",
			suggested_status: null as string | null,
			suggested_notes: null as string | null,
		};

		if (transcriptionText.length > 20) {
			const analysisResponse = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `You are a sales assistant analyzing voice notes from roofing salespeople after door knocks. Extract key information and suggest actions.

Respond in JSON with:
- summary: Brief 1-2 sentence summary of the interaction
- action_items: Array of specific follow-up actions (max 3)
- sentiment: "positive", "neutral", or "negative" based on prospect interest
- suggested_status: Suggest a lead status if appropriate: "contacted", "not_home", "interested", "appointment_set", "not_interested", or null
- suggested_notes: Any important notes to add to the lead record`,
					},
					{
						role: "user",
						content: `Analyze this voice note from a door knock:\n\n"${transcriptionText}"`,
					},
				],
				response_format: { type: "json_object" },
				temperature: 0.3,
				max_tokens: 500,
			});

			const content = analysisResponse.choices[0]?.message?.content;
			if (content) {
				const parsed = JSON.parse(content);
				analysis = {
					summary: parsed.summary || "",
					action_items: parsed.action_items || [],
					sentiment: parsed.sentiment || "neutral",
					suggested_status: parsed.suggested_status || null,
					suggested_notes: parsed.suggested_notes || null,
				};
			}
		}

		// Update voice note record
		await supabaseAdmin
			.from("voice_notes")
			.update({
				transcription: transcriptionText,
				transcription_status: "completed",
				summary: analysis.summary,
				action_items: analysis.action_items,
				sentiment: analysis.sentiment,
				suggested_status: analysis.suggested_status,
				suggested_notes: analysis.suggested_notes,
			})
			.eq("id", voiceNoteId)
			.eq("user_id", userId);

		// Create activity record if we have a lead
		if (leadId) {
			const canAccessLead = await userCanAccessLead(supabaseAdmin, userId, leadId);
			if (!canAccessLead) {
				return;
			}

			await supabaseAdmin.from("activities").insert({
				user_id: userId,
				lead_id: leadId,
				activity_type: "note",
				title: "Voice Note",
				description: analysis.summary || transcriptionText.substring(0, 200),
				outcome: analysis.sentiment,
				metadata: {
					voice_note_id: voiceNoteId,
					action_items: analysis.action_items,
				},
			});

			// Update lead if we have a suggested status
			if (analysis.suggested_status) {
				await supabaseAdmin
					.from("leads")
					.update({
						status: analysis.suggested_status,
						notes: analysis.suggested_notes
							? `${analysis.suggested_notes}\n\n[Voice Note: ${new Date().toLocaleDateString()}]`
							: undefined,
						updated_at: new Date().toISOString(),
					})
					.eq("id", leadId);
			}
		}

		console.log(`✅ Voice note ${voiceNoteId} transcribed and analyzed`);
	} catch (error) {
		console.error("Transcription error:", error);
		
		// Mark as failed
		await supabaseAdmin
			.from("voice_notes")
			.update({
				transcription_status: "failed",
			})
			.eq("id", voiceNoteId)
			.eq("user_id", userId);
	}
}
