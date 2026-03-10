import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Daily NOAA Hail Sync Cron Job
 * 
 * Fetches today's hail reports from NOAA SPC and inserts them into the database.
 * Run daily via Vercel Cron or external scheduler.
 * 
 * NOAA SPC Daily Reports URL format:
 * https://www.spc.noaa.gov/climo/reports/YYMMDD_rpts_hail.csv
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Vercel Cron configuration - run at 6 AM UTC daily
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HailEvent {
  event_date: string;
  event_time: string | null;
  timezone: number;
  state: string;
  county: string;
  location_name: string;
  latitude: number;
  longitude: number;
  size_inches: number;
  comments: string;
  source: string;
}

function parseNOAATime(time: string): string | null {
  // NOAA uses HHMM format (e.g., "1430" for 2:30 PM)
  if (!time || time.length !== 4) return null;
  const hours = time.substring(0, 2);
  const minutes = time.substring(2, 4);
  return `${hours}:${minutes}:00`;
}

function formatDateForNOAA(date: Date): string {
  // NOAA uses YYMMDD format
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateForDB(date: Date): string {
  // Database uses YYYY-MM-DD format
  return date.toISOString().split('T')[0];
}

async function fetchAndParseNOAAData(date: Date): Promise<HailEvent[]> {
  const dateStr = formatDateForNOAA(date);
  const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_hail.csv`;
  
  console.log(`Fetching NOAA data from: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'StormClose/1.0 (storm damage assessment tool)',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.log(`No hail data available for ${dateStr}`);
      return [];
    }
    throw new Error(`NOAA fetch failed: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const lines = csvText.trim().split('\n');
  
  // Skip header row
  // Format: Time,F_Scale,Location,County,State,Lat,Lon,Comments
  // But SPC daily reports use: Time,Size,Location,County,State,Lat,Lon,Comments
  const events: HailEvent[] = [];
  const dbDate = formatDateForDB(date);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV (handle quoted fields)
    const parts = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
    if (!parts || parts.length < 7) continue;

    // Clean up parts (remove leading comma and quotes)
    const cleanParts = parts.map(p => {
      let clean = p.startsWith(',') ? p.substring(1) : p;
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1).replace(/""/g, '"');
      }
      return clean.trim();
    });

    const [time, size, location, county, state, lat, lon, ...commentParts] = cleanParts;
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    // Size is in hundredths of inches (e.g., 175 = 1.75 inches)
    const sizeRaw = parseFloat(size);
    const sizeInches = sizeRaw >= 10 ? sizeRaw / 100 : sizeRaw; // Handle both formats

    // Validate data
    if (isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) continue;
    if (isNaN(sizeInches) || sizeInches <= 0) continue;
    if (!state || state.length !== 2) continue;

    events.push({
      event_date: dbDate,
      event_time: parseNOAATime(time),
      timezone: 3, // CST
      state: state.toUpperCase(),
      county: county || '',
      location_name: location || '',
      latitude: Math.round(latitude * 100) / 100, // Round to 2 decimals
      longitude: Math.round(longitude * 100) / 100,
      size_inches: Math.round(sizeInches * 100) / 100,
      comments: commentParts.join(', '),
      source: 'noaa_daily',
    });
  }

  return events;
}

export async function GET(request: Request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const results = {
      dates_processed: [] as string[],
      total_events: 0,
      inserted: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    // Sync last 3 days to catch any delayed reports
    const today = new Date();
    const datesToSync = [
      new Date(today.getTime() - 0 * 24 * 60 * 60 * 1000), // Today
      new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    ];

    for (const date of datesToSync) {
      const dateStr = formatDateForDB(date);
      results.dates_processed.push(dateStr);

      try {
        const events = await fetchAndParseNOAAData(date);
        results.total_events += events.length;

        if (events.length > 0) {
          // Upsert events (ignore duplicates)
          const { data, error } = await supabase
            .from('hail_events')
            .upsert(events, {
              onConflict: 'event_date,event_time,latitude,longitude,size_inches',
              ignoreDuplicates: true,
            })
            .select();

          if (error) {
            results.errors.push(`${dateStr}: ${error.message}`);
          } else {
            results.inserted += data?.length || 0;
            results.duplicates += events.length - (data?.length || 0);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${dateStr}: ${message}`);
      }
    }

    // Log sync completion
    console.log('NOAA Sync Results:', JSON.stringify(results, null, 2));

    return NextResponse.json({
      success: true,
      message: 'NOAA hail data sync completed',
      ...results,
    });
  } catch (error) {
    console.error('NOAA sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
