import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

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
        .single();

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

    // Fetch fresh weather data
    const weather = await fetchWeatherData(latitude, longitude);

    if (!weather) {
      // Return mock data if API fails
      return NextResponse.json({
        weather: getMockWeather(),
        routing_recommendations: getMockRecommendations(),
        cached: false,
      });
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
  if (!OPENWEATHER_API_KEY) {
    console.log('OpenWeather API key not configured');
    return null;
  }

  try {
    // Get current weather and forecast
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`),
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      return null;
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    // Parse hourly forecast (next 12 hours)
    const hourlyForecast: HourlyForecast[] = forecast.list.slice(0, 4).map((item: any) => ({
      time: item.dt_txt,
      hour: new Date(item.dt * 1000).getHours(),
      temperature: Math.round(item.main.temp),
      conditions: item.weather[0]?.main || 'Clear',
      icon: item.weather[0]?.icon || '01d',
      precipitation_chance: Math.round((item.pop || 0) * 100),
      wind_speed: Math.round(item.wind?.speed || 0),
    }));

    // Get wind direction as compass
    const windDeg = current.wind?.deg || 0;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const windDirection = directions[Math.round(windDeg / 45) % 8];

    return {
      temperature: Math.round(current.main?.temp || 0),
      feels_like: Math.round(current.main?.feels_like || 0),
      humidity: current.main?.humidity || 0,
      wind_speed: Math.round(current.wind?.speed || 0),
      wind_direction: windDirection,
      conditions: current.weather[0]?.main || 'Clear',
      conditions_icon: current.weather[0]?.icon || '01d',
      precipitation_chance: Math.round((forecast.list[0]?.pop || 0) * 100),
      precipitation_type: getPrecipitationType(current.weather[0]?.id),
      hourly_forecast: hourlyForecast,
      alerts: [], // Would need separate alerts API call
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

function getPrecipitationType(weatherId: number): string | null {
  if (!weatherId) return null;
  if (weatherId >= 200 && weatherId < 300) return 'thunderstorm';
  if (weatherId >= 300 && weatherId < 400) return 'drizzle';
  if (weatherId >= 500 && weatherId < 600) return 'rain';
  if (weatherId >= 600 && weatherId < 700) return 'snow';
  return null;
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

function getMockWeather(): WeatherData {
  return {
    temperature: 72,
    feels_like: 74,
    humidity: 45,
    wind_speed: 8,
    wind_direction: 'SW',
    conditions: 'Partly Cloudy',
    conditions_icon: '02d',
    precipitation_chance: 15,
    precipitation_type: null,
    hourly_forecast: [
      { time: '2026-03-10 12:00', hour: 12, temperature: 72, conditions: 'Cloudy', icon: '03d', precipitation_chance: 15, wind_speed: 8 },
      { time: '2026-03-10 15:00', hour: 15, temperature: 75, conditions: 'Sunny', icon: '01d', precipitation_chance: 10, wind_speed: 10 },
      { time: '2026-03-10 18:00', hour: 18, temperature: 70, conditions: 'Clear', icon: '01d', precipitation_chance: 5, wind_speed: 6 },
      { time: '2026-03-10 21:00', hour: 21, temperature: 65, conditions: 'Clear', icon: '01n', precipitation_chance: 5, wind_speed: 4 },
    ],
    alerts: [],
  };
}

function getMockRecommendations() {
  return {
    can_canvas: true,
    optimal_hours: [15, 16, 17, 18],
    warnings: [],
    tips: [
      'Perfect weather for canvassing today!',
      'Prime evening hours coming up - homeowners returning from work',
      'Partly cloudy - no harsh sun, great for being outside',
    ],
  };
}
