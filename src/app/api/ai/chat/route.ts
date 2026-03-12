import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are the StormClose AI Sales Assistant — an expert in storm damage restoration sales, insurance claims, and roofing. You help field sales reps close more deals.

CAPABILITIES:
1. **Property Analysis**: When given an address, analyze property data, storm exposure, and generate a tailored pitch
2. **Objection Handling**: Generate carrier-specific objection responses with policy references
3. **Supplement Generation**: Analyze Xactimate estimates and identify missing line items
4. **Negotiation Coaching**: Help with adjuster meetings, insurance negotiations
5. **Sales Scripts**: Generate door-knock scripts, follow-up templates, call scripts
6. **Training**: Role-play as a skeptical homeowner for practice

CONTEXT YOU MAY RECEIVE:
- Current location (lat/lng)
- Property data (from CoreLogic API)
- Storm data (from Xweather API)
- Lead information
- Conversation history

RULES:
- Be concise and actionable — reps are in the field
- Use real data when provided, never make up property details
- For objections, always provide the specific insurance policy language to reference
- For supplements, be specific about Xactimate line items and codes
- Format responses with clear headers, bullet points, and bold key phrases
- If asked to role-play, stay in character as a homeowner
- Always focus on helping the rep earn the homeowner's trust and close the deal ethically`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, history = [], context = {} } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Build context string from provided data
    let contextStr = '';
    if (context.location) {
      contextStr += `\n\nUSER LOCATION: ${context.location.lat}, ${context.location.lng}`;
    }
    if (context.property) {
      const p = context.property;
      contextStr += `\n\nCURRENT PROPERTY DATA:
- Address: ${p.address}
- Owner: ${p.owner?.name || 'Unknown'}
- Value: $${p.property?.value?.toLocaleString() || 'Unknown'}
- Year Built: ${p.property?.yearBuilt || 'Unknown'}
- Sq Ft: ${p.property?.squareFootage?.toLocaleString() || 'Unknown'}
- Roof Age: ${p.roof?.age || 'Unknown'} years
- Roof Material: ${p.roof?.material || 'Unknown'}
- Roof Sqft: ${p.roof?.squareFootage?.toLocaleString() || 'Unknown'}
- Storm Exposure: ${p.stormExposure?.summary || 'No data'}
- Hail Events: ${p.stormExposure?.hailEvents || 0}
- Max Hail Size: ${p.stormExposure?.maxHailSize || 0}"
- Claim Estimate: $${p.claimEstimate?.total?.toLocaleString() || 'Unknown'}`;
    }
    if (context.storm) {
      contextStr += `\n\nACTIVE STORM DATA:
- Type: ${context.storm.type}
- Severity: ${context.storm.severity}
- Hail Size: ${context.storm.hailSize || 'N/A'}"
- Wind Speed: ${context.storm.windSpeed || 'N/A'} mph
- Location: ${context.storm.location || 'Unknown'}`;
    }
    if (context.lead) {
      contextStr += `\n\nLEAD INFO:
- Address: ${context.lead.address}
- Score: ${context.lead.lead_score || context.lead.score}
- Status: ${context.lead.status}`;
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + contextStr },
      ...history.slice(-10).map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 1500,
      messages,
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Detect if the user is asking about a property (for auto-lookup)
    const addressMatch = message.match(/(?:I'm at|I am at|lookup|look up|check)\s+(.+)/i);
    let suggestLookup = false;
    let suggestedAddress = '';
    if (addressMatch) {
      suggestLookup = true;
      suggestedAddress = addressMatch[1].trim();
    }

    return NextResponse.json({
      success: true,
      reply,
      suggestLookup,
      suggestedAddress,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
      },
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat' },
      { status: 500 }
    );
  }
}
