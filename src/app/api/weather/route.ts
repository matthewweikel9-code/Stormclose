import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveAlerts } from '@/lib/xweather';

const XWEATHER_CLIENT_ID = process.env.XWEATHER_CLIENT_ID;
const XWEATHER_CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET;
const XWEATHER_BASE_URL = "https://data.api.xweather.com";

interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_direction: string;
  conditions: string;
  conditions_icon: string;
  precipitation_chance: number;
  precipitation_type: string | null;
  hourly_forecast: HourlyForecast[];
  alerts: WeatherAlert[];
}

interface HourlyForecast {
  time: string;
  hour: number;
  temperature: number;
  conditions: string;
  icon: string;
  precipitation_chance: number;
  wind_speed: number;
}

interface WeatherAlert {
  event: string;
  headline: string;
  severity: string;
  start: string;
  end: string;
}

// GET: Get weather for a location with routing recommendations
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
      // Try to get user's default location
      const { data: settings } = await supabase
        .from('user_settings')
        .select('default_latitude, default_longitude')
        .eq('user_id', user.id)
        .single() as { data: { default_latitude: number; default_longitude: number } | null };

      if (!settings?.default_latitude || !settings?.default_longitude) {
        return NextResponse.json({ 
          error: 'Location required. Pass lat/lng or set default location.' 
        }, { status: 400 });
      }
    }

    const latitude = parseFloat(lat || '0');
    const longitude = parseFloat(lng || '0');

    // Check cache first
    const { data: cached } = await (supabase.from('weather_cache') as any)
      .select('*')
      .eq('latitude', Math.round(latitude * 100) / 100) // Round to 2 decimals for cache key
      .eq('longitude', Math.round(longitude * 100) / 100)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      return NextResponse.json({
        weather: {
          temperature: cached.temperature_f,
          feels_like: cached.feels_like_f,
          humidity: cached.humidity,
          wind_speed: cached.wind_speed_mph,
          wind_direction: cached.wind_direction,
          conditions: cached.conditions,
          conditions_icon: cached.conditions_icon,
          precipitation_chance: cached.precipitation_chance,
          precipitation_type: cached.precipitation_type,
          hourly_forecast: cached.hourly_forecast,
          alerts: cached.active_alerts,
        },
        routing_recommendations: generateRoutingRecommendations(cached),
        cached: true,
      });
    }

    // Fetch fresh weather data from Xweather
    const weather = await fetchWeatherData(latitude, longitude);

    if (!weather) {
      return NextResponse.json({
        error: 'Weather data unavailable',
        message: 'Could not fetch weather data. Please check your Xweather API credentials.',
        weather: null,
        routing_recommendations: null,
        cached: false,
      }, { status: 503 });
    }

    // Cache the weather data
    await (supabase.from('weather_cache') as any)
      .upsert({
        latitude: Math.round(latitude * 100) / 100,
        longitude: Math.round(longitude * 100) / 100,
        temperature_f: weather.temperature,
        feels_like_f: weather.feels_like,
        humidity: weather.humidity,
        wind_speed_mph: weather.wind_speed,
        wind_direction: weather.wind_direction,
        conditions: weather.conditions,
        conditions_icon: weather.conditions_icon,
        precipitation_chance: weather.precipitation_chance,
        precipitation_type: weather.precipitation_type,
        hourly_forecast: weather.hourly_forecast,
        active_alerts: weather.alerts,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min cache
      });

    return NextResponse.json({
      weather,
      routing_recommendations: generateRoutingRecommendations(weather),
      cached: false,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function fetchWeatherData(lat: number, lng: number): Promise<WeatherData | null> {
  if (!XWEATHER_CLIENT_ID || !XWEATHER_CLIENT_SECRET) {
    console.log('Xweather API credentials not configured');
    return null;
  }

  try {
    const authParams = `client_id=${XWEATHER_CLIENT_ID}&client_secret=${XWEATHER_CLIENT_SECRET}`;

    // Fetch current conditions, hourly forecast, and alerts in parallel
    const [conditionsRes, forecastRes, alerts] = await Promise.all([
      fetch(`${XWEATHER_BASE_URL}/conditions/${lat},${lng}?${authParams}`),
      fetch(`${XWEATHER_BASE_URL}/forecasts/${lat},${lng}?filter=1hr&limit=12&${authParams}`),
      getActiveAlerts(lat, lng).catch(() => []),
    ]);

    if (!conditionsRes.ok || !forecastRes.ok) {
      console.error('Xweather API error:', conditionsRes.status, forecastRes.status);
      return null;
    }

    const conditionsData = await conditionsRes.json();
    const forecastData = await forecastRes.json();

    if (!conditionsData.success || !conditionsData.response?.length) {
      console.error('Xweather conditions: no data returned');
      return null;
    }

    const current = conditionsData.response[0].periods[0];
    const forecastPeriods = forecastData.success ? (forecastData.response?.[0]?.periods || []) : [];

    // Parse hourly forecast
    const hourlyForecast: HourlyForecast[] = forecastPeriods.slice(0, 8).map((period: any) => ({
      time: period.dateTimeISO,
      hour: new Date(period.dateTimeISO).getHours(),
      temperature: Math.round(period.tempF ?? period.avgTempF ?? 0),
      conditions: period.weatherPrimary || period.weather || 'Clear',
      icon: period.icon || 'clear.png',
      precipitation_chance: period.pop || 0,
      wind_speed: Math.round(period.windSpeedMPH || 0),
    }));

    // Determine precipitation type from weather coded string
    const weatherCoded = current.weatherPrimaryCoded || '';
    let precipType: string | null = null;
    if (weatherCoded.includes('T')) precipType = 'thunderstorm';
    else if (weatherCoded.includes('R') || weatherCoded.includes('L')) precipType = 'rain';
    else if (weatherCoded.includes('S') || weatherCoded.includes('BS')) precipType = 'snow';
    else if (weatherCoded.includes('ZR') || weatherCoded.includes('IP')) precipType = 'ice';

    // Format alerts
    const formattedAlerts: WeatherAlert[] = alerts.map((a: any) => ({
      event: a.details?.type || a.details?.name || 'Weather Alert',
      headline: a.details?.body?.split('\n')[0] || a.details?.name || '',
      severity: a.details?.emergency ? 'extreme' : a.details?.significance === 'W' ? 'severe' : 'moderate',
      start: a.timestamps?.beginsISO || '',
      end: a.timestamps?.expiresISO || '',
    }));

    return {
      temperature: Math.round(current.tempF || 0),
      feels_like: Math.round(current.feelslikeF || 0),
      humidity: current.humidity || 0,
      wind_speed: Math.round(current.windSpeedMPH || 0),
      wind_direction: current.windDir || 'N',
      conditions: current.weatherPrimary || current.weather || 'Clear',
      conditions_icon: current.icon || 'clear.png',
      precipitation_chance: current.pop || forecastPeriods[0]?.pop || 0,
      precipitation_type: precipType,
      hourly_forecast: hourlyForecast,
      alerts: formattedAlerts,
    };
  } catch (error) {
    console.error('Error fetching weather from Xweather:', error);
    return null;
  }
}

function generateRoutingRecommendations(weather: any): {
  can_canvas: boolean;
  optimal_hours: number[];
  warnings: string[];
  tips: string[];
} {
  const recommendations = {
    can_canvas: true,
    optimal_hours: [] as number[],
    warnings: [] as string[],
    tips: [] as string[],
  };

  const temp = weather.temperature_f || weather.temperature;
  const precipChance = weather.precipitation_chance;
  const windSpeed = weather.wind_speed_mph || weather.wind_speed;
  const hourly = weather.hourly_forecast || [];

  // Check current conditions
  if (precipChance > 70) {
    recommendations.warnings.push(`High chance of precipitation (${precipChance}%)`);
    if (precipChance > 90) {
      recommendations.can_canvas = false;
      recommendations.warnings.push('Consider rescheduling - very high precipitation chance');
    }
  }

  if (windSpeed > 25) {
    recommendations.warnings.push(`High winds (${windSpeed} mph) - be careful with ladders`);
  }

  if (temp < 32) {
    recommendations.warnings.push('Freezing temperatures - watch for icy surfaces');
    recommendations.tips.push('Wear warm layers and non-slip footwear');
  } else if (temp > 95) {
    recommendations.warnings.push('Extreme heat - stay hydrated');
    recommendations.tips.push('Take breaks in shade, avoid peak sun hours (12-3pm)');
  }

  // Find optimal hours from forecast
  hourly.forEach((hour: any) => {
    const hourPrecip = hour.precipitation_chance;
    const hourTemp = hour.temperature;
    
    if (hourPrecip < 30 && hourTemp > 50 && hourTemp < 90) {
      recommendations.optimal_hours.push(hour.hour);
    }
  });

  // Add tips based on conditions
  if (weather.conditions?.toLowerCase().includes('cloud')) {
    recommendations.tips.push('Overcast sky is great for canvassing - no harsh sun');
  }

  if (precipChance > 30 && precipChance < 70) {
    recommendations.tips.push('Rain possible - have covered areas in mind for shelter');
  }

  // Time-based recommendations
  const currentHour = new Date().getHours();
  if (currentHour >= 16 && currentHour <= 19) {
    recommendations.tips.push('Prime evening hours - homeowners returning from work');
  } else if (currentHour >= 10 && currentHour <= 14) {
    recommendations.tips.push('Good midday hours for retired homeowners and work-from-home');
  }

  return recommendations;
}
