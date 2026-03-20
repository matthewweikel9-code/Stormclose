/**
 * NWS (National Weather Service) fallback for storm data.
 * Free, real-time severe weather alerts when Xweather returns empty.
 * US only.
 */

export interface NWSStormEvent {
  id: string;
  type: "hail" | "wind" | "tornado" | "severe_thunderstorm";
  severity: "minor" | "moderate" | "severe" | "extreme";
  lat: number;
  lng: number;
  radius: number;
  startTime: string;
  endTime?: string;
  damageScore: number;
  location?: string;
  isActive: boolean;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function buildLocationLabel(input: {
  locationName?: string | null;
  county?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
}): string {
  const parts: string[] = [];
  if (input.locationName) parts.push(input.locationName);
  if (input.county && input.state) parts.push(`${input.county.replace(/\s*county$/i, "").trim()} County, ${input.state}`);
  else if (input.state) parts.push(input.state);
  if (parts.length > 0) return parts.join(", ");
  return `${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}`;
}

/**
 * Fetch active NWS severe weather alerts (real-time).
 * Returns storm events when Xweather is empty.
 */
export async function fetchNWSStormEvents(
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): Promise<NWSStormEvent[]> {
  const response = await fetch(
    "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Tornado%20Warning",
    { headers: { "User-Agent": "StormAI/1.0" } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  const features = data.features || [];

  return features.flatMap((f: any, i: number) => {
    const props = f.properties;
    const geometry = f.geometry;

    let type: NWSStormEvent["type"] = "severe_thunderstorm";
    if (props.event?.toLowerCase().includes("tornado")) type = "tornado";
    else if (props.event?.toLowerCase().includes("hail") || props.headline?.toLowerCase().includes("hail")) type = "hail";
    else if (props.event?.toLowerCase().includes("wind")) type = "wind";

    let severity: NWSStormEvent["severity"] = "moderate";
    if (props.severity === "Extreme") severity = "extreme";
    else if (props.severity === "Severe") severity = "severe";

    let lat = 35.0,
      lng = -98.0;
    if (geometry?.coordinates) {
      if (geometry.type === "Polygon" && geometry.coordinates[0]) {
        const coords = geometry.coordinates[0];
        lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
        lng = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
      }
    }
    if (calculateDistanceMiles(centerLat, centerLng, lat, lng) > radiusMiles) {
      return [];
    }
    const areaDescription =
      typeof props.areaDesc === "string" && props.areaDesc.trim().length > 0
        ? props.areaDesc.split(";")[0].trim()
        : null;

    return {
      id: props.id || `nws-${i}`,
      type,
      severity,
      lat,
      lng,
      radius: 15,
      startTime: props.onset || props.effective,
      endTime: props.expires,
      damageScore: severity === "extreme" ? 90 : severity === "severe" ? 75 : 55,
      location: buildLocationLabel({
        locationName: areaDescription,
        county: null,
        state: null,
        lat,
        lng,
      }),
      isActive: true,
    };
  });
}
