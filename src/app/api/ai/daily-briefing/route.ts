import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const XWEATHER_CLIENT_ID = process.env.XWEATHER_CLIENT_ID;
const XWEATHER_CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET;
const XWEATHER_BASE_URL = 'https://data.api.xweather.com';

// AI Daily Briefing — synthesizes live storm data + leads + forecast into natural language
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
    }

    // Fetch live data in parallel: storms, forecast, leads
    const authParams = `client_id=${XWEATHER_CLIENT_ID}&client_secret=${XWEATHER_CLIENT_SECRET}`;

    const [stormsRes, forecastRes, leadsRes] = await Promise.all([
      // Recent storm reports (last 24h)
      fetch(`${XWEATHER_BASE_URL}/stormreports/closest?p=${lat},${lng}&radius=100mi&from=-24hours&limit=25&sort=dt:-1&client_id=${XWEATHER_CLIENT_ID}&client_secret=${XWEATHER_CLIENT_SECRET}`).catch(() => null),
      // Today's forecast
      fetch(`${XWEATHER_BASE_URL}/forecasts/${lat},${lng}?filter=day&limit=1&${authParams}`).catch(() => null),
      // Hot leads from our database
      fetch(`${new URL(request.url).origin}/api/leads?tier=hot&limit=10`, {
        headers: { cookie: request.headers.get('cookie') || '' },
      }).catch(() => null),
    ]);

    let stormCount = 0;
    let stormSummary = 'No storms reported nearby in the last 24 hours.';
    let maxHailSize = 0;
    let stormLocations: string[] = [];

    if (stormsRes?.ok) {
      const stormsData = await stormsRes.json();
      const reports = stormsData.response || [];
      stormCount = reports.length;
      if (stormCount > 0) {
        const hailReports = reports.filter((r: any) => r.report?.cat === 'hail');
        maxHailSize = Math.max(0, ...hailReports.map((r: any) => r.report?.detail?.hailIN || 0));
        stormLocations = [...new Set(reports.slice(0, 5).map((r: any) => `${r.place?.name}, ${r.place?.state}`))] as string[];
        stormSummary = `${stormCount} storm reports in the last 24 hours. ${hailReports.length} hail reports (max ${maxHailSize}" hail). Locations: ${stormLocations.join(', ')}.`;
      }
    }

    let forecastSummary = 'Forecast unavailable.';
    if (forecastRes?.ok) {
      const forecastData = await forecastRes.json();
      const today = forecastData.response?.[0]?.periods?.[0];
      if (today) {
        forecastSummary = `Today: ${today.weatherPrimary || 'Clear'}, High ${Math.round(today.maxTempF || 0)}°F, ${today.pop || 0}% precip chance, wind ${Math.round(today.windSpeedMPH || 0)} mph.`;
      }
    }

    let hotLeadCount = 0;
    let topLeadAddress = '';
    if (leadsRes?.ok) {
      const leadsData = await leadsRes.json();
      const leads = leadsData.leads || [];
      hotLeadCount = leads.length;
      if (leads.length > 0) {
        topLeadAddress = leads[0].address || leads[0].name || 'Unknown';
      }
    }

    // Generate AI briefing using OpenAI
    const prompt = `You are an AI assistant for a storm damage roofing sales platform called StormClose. Generate a concise, actionable daily briefing for a field sales rep.

DATA:
- Storm Activity: ${stormSummary}
- Weather Forecast: ${forecastSummary}  
- Hot Leads: ${hotLeadCount} leads ready to contact${topLeadAddress ? `. Top lead: ${topLeadAddress}` : ''}
- Location: ${lat.toFixed(2)}, ${lng.toFixed(2)}

Generate a briefing in this JSON format:
{
  "headline": "One-line summary of the day's opportunity (max 15 words)",
  "summary": "2-3 sentence overview of what happened overnight and what to focus on today",
  "actions": ["Action item 1", "Action item 2", "Action item 3"],
  "opportunity_score": <number 1-100 based on storm activity and lead availability>,
  "weather_advisory": "One sentence about canvassing conditions today",
  "best_time_to_canvas": "e.g. 10am-2pm"
}

Be specific with real data. No fluff. Focus on revenue opportunity.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are a storm damage sales intelligence AI. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    let briefing;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      briefing = JSON.parse(cleaned);
    } catch {
      briefing = {
        headline: stormCount > 0 ? `${stormCount} storms detected — ${hotLeadCount} leads ready` : 'Clear skies — focus on follow-ups',
        summary: `${stormSummary} ${hotLeadCount > 0 ? `You have ${hotLeadCount} hot leads to contact.` : 'No hot leads right now.'}`,
        actions: ['Check Command Center for storm updates', 'Review hot leads', 'Plan your route'],
        opportunity_score: stormCount > 0 ? 70 : 30,
        weather_advisory: forecastSummary,
        best_time_to_canvas: '10am - 3pm',
      };
    }

    return NextResponse.json({
      success: true,
      briefing,
      raw: {
        stormCount,
        maxHailSize,
        hotLeadCount,
        stormLocations,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Daily Briefing] Error:', error);
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}
