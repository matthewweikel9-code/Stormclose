import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreOneLead } from "@/lib/scoreOneLead";

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Batch-rescore all leads that have sub-component scores stored.
 * Recalculates `lead_score` from the individual score columns and persists.
 */
export async function rescoreAllLeads(): Promise<{
  rescored: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let rescored = 0;

  const { data: leads, error: fetchErr } = await supabaseAdmin
    .from("leads")
    .select(
      "id, storm_proximity_score, roof_age_score, roof_size_score, property_value_score, hail_history_score, lead_score"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (fetchErr) {
    errors.push(`Fetch error: ${fetchErr.message}`);
    return { rescored: 0, errors };
  }

  if (!leads || leads.length === 0) {
    return { rescored: 0, errors: ["No leads found to rescore"] };
  }

  for (const lead of leads) {
    const { totalScore } = scoreOneLead({
      stormProximityScore: lead.storm_proximity_score ?? 0,
      roofAgeScore: lead.roof_age_score ?? 0,
      roofSizeScore: lead.roof_size_score ?? 0,
      propertyValueScore: lead.property_value_score ?? 0,
      hailHistoryScore: lead.hail_history_score ?? 0,
    });

    if (totalScore !== lead.lead_score) {
      const { error: updateErr } = await supabaseAdmin
        .from("leads")
        .update({ lead_score: totalScore })
        .eq("id", lead.id);

      if (updateErr) {
        errors.push(`Update error for ${lead.id}: ${updateErr.message}`);
      } else {
        rescored++;
      }
    }
  }

  return { rescored, errors };
}

// Cron endpoint — runs on schedule or manual trigger
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === "production" && cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("Starting batch lead rescore…");
  const startTime = Date.now();

  try {
    const result = await rescoreAllLeads();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Rescore complete: ${result.rescored} leads updated in ${duration}s`);

    return NextResponse.json({
      success: true,
      rescored: result.rescored,
      duration: `${duration}s`,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
    });
  } catch (error: unknown) {
    console.error("Rescore error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
