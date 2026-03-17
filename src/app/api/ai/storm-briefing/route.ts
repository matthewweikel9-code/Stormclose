import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/ai/storm-briefing
 * 
 * Generate an AI analysis for a specific storm event.
 * Returns deployment recommendation, property analysis, competitive window, etc.
 * 
 * Body:
 *   - lat, lng: storm center coordinates
 *   - hailSize: hail size in inches (optional)
 *   - windSpeed: wind speed in mph (optional)
 *   - eventType: hail | wind | tornado | severe_thunderstorm
 *   - location: human-readable location name
 *   - estimatedProperties: pre-calculated estimate (optional)
 *   - estimatedOpportunity: pre-calculated dollar value (optional)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkFeatureAccess(user.id, "lead_generator");
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.reason || "Upgrade required for Storm Briefing AI.",
        code: "UPGRADE_REQUIRED",
        feature: "lead_generator",
        tier: access.tier || "free",
        upgradeUrl: "/settings/billing",
      },
      { status: 402 }
    );
  }

  try {
    const body = await request.json();
    const {
      lat,
      lng,
      hailSize,
      windSpeed,
      eventType = "hail",
      location = "Unknown",
      county,
      state,
      damageScore,
      estimatedProperties,
      estimatedOpportunity,
      occurredAt,
    } = body;

    if (!lat || !lng) {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }

    // Fetch context data in parallel
    const [leadsData, goalsData] = await Promise.all([
      // Existing leads near this storm
      supabase
        .from("leads")
        .select("id, address, status, estimated_claim, lead_score, roof_age, latitude, longitude")
        .eq("user_id", user.id)
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      // User's goals for context
      (supabase.from("user_goals") as any)
        .select("monthly_revenue_goal, commission_rate, monthly_deal_goal")
        .eq("user_id", user.id)
        .order("month", { ascending: false })
        .limit(1)
        .single(),
    ]);

    // Filter leads within ~20 miles of storm (rough estimate using lat/lng delta)
    const nearbyLeads = (leadsData.data || []).filter((lead: any) => {
      if (!lead.latitude || !lead.longitude) return false;
      const latDiff = Math.abs(lead.latitude - lat);
      const lngDiff = Math.abs(lead.longitude - lng);
      return latDiff < 0.3 && lngDiff < 0.3; // ~20 miles rough
    });

    const existingLeadsInArea = nearbyLeads.length;
    const activeLeads = nearbyLeads.filter((l: any) => !["closed", "lost"].includes(l.status)).length;
    const avgRoofAge = nearbyLeads.length > 0
      ? Math.round(nearbyLeads.reduce((sum: number, l: any) => sum + (l.roof_age || 15), 0) / nearbyLeads.length)
      : 15;

    const goals = goalsData.data || { monthly_revenue_goal: 25000, commission_rate: 0.1, monthly_deal_goal: 4 };

    // Build the AI prompt
    const eventDescription = buildEventDescription({
      eventType,
      hailSize,
      windSpeed,
      location,
      county,
      state,
      damageScore,
      estimatedProperties,
      estimatedOpportunity,
      occurredAt,
    });

    const contextBlock = [
      `STORM EVENT: ${eventDescription}`,
      `EXISTING COVERAGE: ${existingLeadsInArea} leads in this area (${activeLeads} active)`,
      `AVG ROOF AGE IN AREA: ~${avgRoofAge} years`,
      `USER MONTHLY GOAL: $${(goals.monthly_revenue_goal || 25000).toLocaleString()} revenue`,
      `EST. PROPERTIES AFFECTED: ${estimatedProperties || "unknown"}`,
      `EST. OPPORTUNITY VALUE: $${(estimatedOpportunity || 0).toLocaleString()}`,
      `DAYS SINCE EVENT: ${occurredAt ? Math.floor((Date.now() - new Date(occurredAt).getTime()) / 86400000) : "unknown"}`,
    ].join("\n");

    const systemPrompt = `You are a storm damage sales intelligence AI for a roofing/restoration contractor. 
You analyze storm events and provide tactical deployment recommendations.
Your tone is direct, data-driven, and action-oriented — like a military operations briefing.
Use numbers and metrics wherever possible.
Keep your response under 300 words.
Format with clear sections using emoji headers.`;

    const userPrompt = `Analyze this storm event and give me a deployment briefing:

${contextBlock}

Provide:
1. 🎯 DEPLOYMENT RECOMMENDATION (deploy/hold/monitor) with confidence (high/medium/low)
2. 💰 REVENUE ANALYSIS — estimated total addressable market, avg claim value, realistic capture rate
3. 🏠 PROPERTY PROFILE — what kind of properties are likely affected, roof age significance
4. ⏰ COMPETITIVE WINDOW — how many days until adjusters/competitors saturate the area
5. 📋 ACTION ITEMS — 3 specific next steps (numbered)

Be specific with dollar amounts and property counts. If hail ≥ 1.5", emphasize urgency.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const briefing = completion.choices[0]?.message?.content || "Unable to generate briefing.";

    // Parse deployment recommendation from the response
    const deploymentRec = parseDeploymentRecommendation(briefing);

    return NextResponse.json({
      success: true,
      briefing,
      recommendation: deploymentRec,
      context: {
        existingLeadsInArea,
        activeLeads,
        avgRoofAge,
        estimatedProperties: estimatedProperties || 0,
        estimatedOpportunity: estimatedOpportunity || 0,
        eventType,
        hailSize,
        windSpeed,
        location,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AI Storm Briefing] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate storm briefing", details: String(error) },
      { status: 500 }
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildEventDescription(event: {
  eventType: string;
  hailSize?: number;
  windSpeed?: number;
  location: string;
  county?: string;
  state?: string;
  damageScore?: number;
  estimatedProperties?: number;
  estimatedOpportunity?: number;
  occurredAt?: string;
}): string {
  const parts: string[] = [];

  if (event.eventType === "hail") {
    parts.push(`${event.hailSize || "Unknown"}" hail reported`);
  } else if (event.eventType === "tornado") {
    parts.push("Tornado reported");
  } else if (event.eventType === "wind") {
    parts.push(`${event.windSpeed || "Unknown"}mph straight-line winds`);
  } else {
    parts.push("Severe thunderstorm reported");
  }

  parts.push(`in ${event.location}${event.county ? `, ${event.county} County` : ""}${event.state ? `, ${event.state}` : ""}`);

  if (event.occurredAt) {
    const date = new Date(event.occurredAt);
    parts.push(`on ${date.toLocaleDateString()}`);
  }

  if (event.damageScore) {
    parts.push(`(damage score: ${event.damageScore}/100)`);
  }

  return parts.join(" ");
}

function parseDeploymentRecommendation(briefing: string): {
  action: "deploy" | "hold" | "monitor";
  confidence: "high" | "medium" | "low";
} {
  const lower = briefing.toLowerCase();

  let action: "deploy" | "hold" | "monitor" = "monitor";
  if (lower.includes("deploy") && !lower.includes("do not deploy")) {
    action = "deploy";
  } else if (lower.includes("hold")) {
    action = "hold";
  }

  let confidence: "high" | "medium" | "low" = "medium";
  if (lower.includes("high confidence") || lower.includes("confidence: high")) {
    confidence = "high";
  } else if (lower.includes("low confidence") || lower.includes("confidence: low")) {
    confidence = "low";
  }

  return { action, confidence };
}
