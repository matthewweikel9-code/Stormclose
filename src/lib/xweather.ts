/**
 * Xweather API Client
 * Real-time storm reports, hail data, and severe weather alerts
 * 
 * API Docs: https://www.xweather.com/docs/weather-api
 */

const XWEATHER_CLIENT_ID = process.env.XWEATHER_CLIENT_ID;
const XWEATHER_CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET;
const XWEATHER_BASE_URL = "https://data.api.xweather.com";

export interface XweatherStormReport {
  id: string;
  loc: {
    lat: number;
    long: number;
  };
  report: {
    timestamp: number;
    dateTimeISO: string;
    code: string;
    type: string;
    cat: string; // 'hail' | 'wind' | 'tornado' | 'flood' | etc.
    name: string;
    detail: {
      text?: string;
      hailIN?: number;
      hailMM?: number;
      windSpeedMPH?: number;
      windSpeedKPH?: number;
      rainIN?: number;
      snowIN?: number;
    };
    reporter: string;
    wfo: string;
    comments: string;
  };
  place: {
    name: string;
    state: string;
    county: string;
    country: string;
  };
  profile: {
    tz: string;
  };
}

export interface XweatherAlert {
  id: string;
  loc: {
    lat: number;
    long: number;
  };
  details: {
    type: string;
    name: string;
    loc: string;
    emergency: boolean;
    color: string;
    cat: string;
    body: string;
    bodyFull: string;
  };
  timestamps: {
    issued: number;
    issuedISO: string;
    begins: number;
    beginsISO: string;
    expires: number;
    expiresISO: string;
  };
  place: {
    name: string;
    state: string;
    country: string;
  };
  includes?: {
    counties?: string[];
    fips?: string[];
    wxzones?: string[];
  };
}

export interface XweatherStormCell {
  id: string;
  loc: {
    lat: number;
    long: number;
  };
  ob: {
    timestamp: number;
    dateTimeISO: string;
  };
  place: {
    name: string;
    state: string;
    county: string;
    country: string;
  };
  dbz: {
    avg: number;
    max: number;
  };
  hail: {
    prob: number;
    probSevere: number;
    maxSizeIN: number;
  };
  tornado: {
    vrot: number | null;
    prob: number;
  };
  traits: {
    rotating: boolean;
    hail: boolean;
    severe: boolean;
    tornadic: boolean;
  };
  track: {
    speedMPH: number;
    directionDEG: number;
    points: Array<{ lat: number; long: number; timestamp: number }>;
  };
}

interface XweatherResponse<T> {
  success: boolean;
  error?: {
    code: string;
    description: string;
  };
  response: T[];
}

/**
 * Make a request to the Xweather API
 */
async function xweatherRequest<T>(
  endpoint: string,
  action: string,
  params?: Record<string, string>
): Promise<T[]> {
  if (!XWEATHER_CLIENT_ID || !XWEATHER_CLIENT_SECRET) {
    throw new Error("Xweather API credentials not configured");
  }

  const url = new URL(`${XWEATHER_BASE_URL}/${endpoint}/${action}`);
  url.searchParams.append("client_id", XWEATHER_CLIENT_ID);
  url.searchParams.append("client_secret", XWEATHER_CLIENT_SECRET);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  console.log("[Xweather] Request:", `/${endpoint}/${action}`);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const error = await response.text();
    console.error("[Xweather] API error:", response.status, error);
    throw new Error(`Xweather API error: ${response.status}`);
  }

  const data: XweatherResponse<T> = await response.json();
  
  if (!data.success) {
    console.error("[Xweather] API error:", data.error);
    throw new Error(data.error?.description || "Xweather API request failed");
  }

  return data.response || [];
}

/**
 * Get recent hail reports for a location
 * @param lat Latitude
 * @param lng Longitude  
 * @param radiusMiles Radius in miles (default 50)
 * @param days Days back to search (default 30)
 */
export async function getHailReports(
  lat: number,
  lng: number,
  radiusMiles: number = 50,
  days: number = 30
): Promise<XweatherStormReport[]> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().split('T')[0];
  
  const reports = await xweatherRequest<XweatherStormReport>(
    "stormreports",
    `closest`,
    {
      p: `${lat},${lng}`,
      radius: `${radiusMiles}mi`,
      filter: "hail",
      from: fromStr,
      limit: "100",
      sort: "dt:-1" // Most recent first
    }
  );

  return reports;
}

/**
 * Get recent storm reports (all types) near a location
 */
export async function getStormReports(
  lat: number,
  lng: number,
  radiusMiles: number = 50,
  days: number = 7
): Promise<XweatherStormReport[]> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().split('T')[0];
  
  const reports = await xweatherRequest<XweatherStormReport>(
    "stormreports",
    `closest`,
    {
      p: `${lat},${lng}`,
      radius: `${radiusMiles}mi`,
      from: fromStr,
      limit: "50",
      sort: "dt:-1"
    }
  );

  return reports;
}

/**
 * Get hail reports for a specific zip code
 */
export async function getHailReportsByZip(
  zipCode: string,
  days: number = 30
): Promise<XweatherStormReport[]> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().split('T')[0];
  
  const reports = await xweatherRequest<XweatherStormReport>(
    "stormreports",
    zipCode,
    {
      filter: "hail",
      from: fromStr,
      radius: "25mi",
      limit: "50",
      sort: "dt:-1"
    }
  );

  return reports;
}

/**
 * Get active severe weather alerts for a location
 */
export async function getActiveAlerts(
  lat: number,
  lng: number
): Promise<XweatherAlert[]> {
  const alerts = await xweatherRequest<XweatherAlert>(
    "alerts",
    `${lat},${lng}`,
    {
      limit: "25"
    }
  );

  return alerts;
}

/**
 * Get active alerts for a specific zip code
 */
export async function getAlertsByZip(zipCode: string): Promise<XweatherAlert[]> {
  const alerts = await xweatherRequest<XweatherAlert>(
    "alerts",
    zipCode,
    {
      limit: "25"
    }
  );

  return alerts;
}

/**
 * Get active storm cells (real-time radar-detected storms)
 */
export async function getStormCells(
  lat: number,
  lng: number,
  radiusMiles: number = 100
): Promise<XweatherStormCell[]> {
  const cells = await xweatherRequest<XweatherStormCell>(
    "stormcells",
    `closest`,
    {
      p: `${lat},${lng}`,
      radius: `${radiusMiles}mi`,
      limit: "50"
    }
  );

  return cells;
}

/**
 * Check if a specific address/location had hail damage
 * Returns the largest hail size found within the specified radius and time
 */
export async function verifyHailAtLocation(
  lat: number,
  lng: number,
  days: number = 90
): Promise<{
  hadHail: boolean;
  maxHailSize: number | null;
  reports: XweatherStormReport[];
  summary: string;
}> {
  const reports = await getHailReports(lat, lng, 10, days); // 10 mile radius
  
  const hailReports = reports.filter(r => r.report.cat === 'hail' && r.report.detail.hailIN);
  
  if (hailReports.length === 0) {
    return {
      hadHail: false,
      maxHailSize: null,
      reports: [],
      summary: `No hail reports within 10 miles in the last ${days} days`
    };
  }

  const maxHailSize = Math.max(...hailReports.map(r => r.report.detail.hailIN || 0));
  const mostRecent = hailReports[0];
  
  return {
    hadHail: true,
    maxHailSize,
    reports: hailReports,
    summary: `${hailReports.length} hail report(s) found. Largest: ${maxHailSize}" hail on ${mostRecent.report.dateTimeISO.split('T')[0]} in ${mostRecent.place.name}, ${mostRecent.place.state.toUpperCase()}`
  };
}

/**
 * Get a combined storm feed for the dashboard
 * Includes alerts, recent reports, and active storm cells
 */
export async function getStormFeed(
  lat: number,
  lng: number
): Promise<{
  alerts: XweatherAlert[];
  recentHail: XweatherStormReport[];
  stormCells: XweatherStormCell[];
  summary: {
    activeAlerts: number;
    hailReportsLast7Days: number;
    activeStormCells: number;
    severeStormCells: number;
  };
}> {
  const [alerts, hailReports, stormCells] = await Promise.all([
    getActiveAlerts(lat, lng).catch(() => []),
    getHailReports(lat, lng, 75, 7).catch(() => []),
    getStormCells(lat, lng, 150).catch(() => [])
  ]);

  const severeStormCells = stormCells.filter(c => c.traits.severe || c.traits.hail);

  return {
    alerts,
    recentHail: hailReports,
    stormCells,
    summary: {
      activeAlerts: alerts.length,
      hailReportsLast7Days: hailReports.length,
      activeStormCells: stormCells.length,
      severeStormCells: severeStormCells.length
    }
  };
}

/**
 * Format an Xweather storm report to match our database hail_events format
 */
export function formatStormReportToHailEvent(report: XweatherStormReport) {
  return {
    event_date: report.report.dateTimeISO.split('T')[0],
    event_time: report.report.dateTimeISO.split('T')[1]?.split('-')[0] || null,
    location_name: report.place.name,
    state: report.place.state.toUpperCase(),
    county: report.place.county,
    latitude: report.loc.lat,
    longitude: report.loc.long,
    size_inches: report.report.detail.hailIN || 0,
    source: 'xweather',
    xweather_id: report.id,
    comments: report.report.comments
  };
}
