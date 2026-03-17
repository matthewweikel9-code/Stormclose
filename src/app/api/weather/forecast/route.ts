import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const XWEATHER_CLIENT_ID = process.env.XWEATHER_CLIENT_ID;
const XWEATHER_CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET;
const XWEATHER_BASE_URL = 'https://data.api.xweather.com';

interface DayForecast {
  date: string;
  dayOfWeek: string;
  highF: number;
  lowF: number;
  conditions: string;
  icon: string;
  precipChance: number;
  windSpeedMph: number;
  windGustMph: number;
  humidity: number;
  severeRisk: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  hailRisk: boolean;
  tornadoRisk: boolean;
  windRisk: boolean;
  summary: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
    }

    if (!XWEATHER_CLIENT_ID || !XWEATHER_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Weather API not configured' }, { status: 503 });
    }

    const authParams = `client_id=${XWEATHER_CLIENT_ID}&client_secret=${XWEATHER_CLIENT_SECRET}`;

    // Fetch 7-day forecast from Xweather
    const res = await fetch(
      `${XWEATHER_BASE_URL}/forecasts/${lat},${lng}?filter=day&limit=7&${authParams}`
    );

    if (!res.ok) {
      console.error('[Forecast] Xweather error:', res.status);
      return NextResponse.json({
        forecast: [],
        summary: { severeDays: 0, canvassingDays: 0, nextSevereDay: null, bestCanvassingDay: null },
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        error: 'Weather service temporarily unavailable',
      }, { status: 200 });
    }

    const data = await res.json();

    if (!data.success || !data.response?.length) {
      return NextResponse.json({
        forecast: [],
        summary: { severeDays: 0, canvassingDays: 0, nextSevereDay: null, bestCanvassingDay: null },
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        error: 'No forecast data available',
      }, { status: 200 });
    }

    const periods = data.response[0]?.periods || [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const forecast: DayForecast[] = periods.map((period: any) => {
      const date = new Date(period.dateTimeISO);
      const windGust = period.windGustMPH || period.windSpeedMaxMPH || 0;
      const precipChance = period.pop || 0;
      const conditions = (period.weatherPrimary || period.weather || 'Clear').toLowerCase();

      // Calculate severe weather risk from actual forecast data
      let severeRisk: DayForecast['severeRisk'] = 'none';
      let hailRisk = false;
      let tornadoRisk = false;
      let windRisk = false;

      // Check weather coded strings for severe indicators
      const weatherCoded = period.weatherPrimaryCoded || '';
      if (weatherCoded.includes('T') || conditions.includes('thunder')) {
        severeRisk = 'low';
        if (precipChance > 60) severeRisk = 'moderate';
      }
      if (windGust >= 50) {
        windRisk = true;
        severeRisk = severeRisk === 'none' ? 'moderate' : 'high';
      }
      if (windGust >= 70) {
        severeRisk = 'extreme';
      }
      // Xweather includes hail indicators in coded weather
      if (weatherCoded.includes('A') || weatherCoded.includes('IP')) {
        hailRisk = true;
        severeRisk = severeRisk === 'none' ? 'moderate' : 'high';
      }
      if (weatherCoded.includes('FC') || weatherCoded.includes('TO')) {
        tornadoRisk = true;
        severeRisk = 'extreme';
      }

      return {
        date: period.dateTimeISO,
        dayOfWeek: days[date.getDay()],
        highF: Math.round(period.maxTempF ?? period.tempF ?? 0),
        lowF: Math.round(period.minTempF ?? period.tempF ?? 0),
        conditions: period.weatherPrimary || period.weather || 'Clear',
        icon: period.icon || 'clear.png',
        precipChance,
        windSpeedMph: Math.round(period.windSpeedMPH || period.windSpeedAvgMPH || 0),
        windGustMph: Math.round(windGust),
        humidity: period.humidity || 0,
        severeRisk,
        hailRisk,
        tornadoRisk,
        windRisk,
        summary: period.weatherPrimary || 'Clear',
      };
    });

    // Identify severe weather days for the summary
    const severeDays = forecast.filter(d => d.severeRisk !== 'none' && d.severeRisk !== 'low');
    const canvassingDays = forecast.filter(d => d.severeRisk === 'none' && d.precipChance < 40);

    return NextResponse.json({
      forecast,
      summary: {
        severeDays: severeDays.length,
        canvassingDays: canvassingDays.length,
        nextSevereDay: severeDays[0]?.dayOfWeek || null,
        bestCanvassingDay: canvassingDays[0]?.dayOfWeek || null,
      },
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
  } catch (error) {
    console.error('[Forecast] Error:', error);
    const lat = request.nextUrl.searchParams.get('lat');
    const lng = request.nextUrl.searchParams.get('lng');
    return NextResponse.json({
      forecast: [],
      summary: { severeDays: 0, canvassingDays: 0, nextSevereDay: null, bestCanvassingDay: null },
      location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      error: 'Failed to fetch forecast',
    }, { status: 200 });
  }
}
