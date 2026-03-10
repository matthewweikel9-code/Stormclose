import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyHailAtLocation, getHailReportsByZip } from "@/lib/xweather";

/**
 * POST: Verify if a property/address was affected by hail
 * 
 * Body params:
 * - lat, lng: Coordinates of the property
 * - OR zip: Zip code to check
 * - days: How many days back to check (default 90)
 * 
 * Returns hail verification status and reports
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { lat, lng, zip, days = 90, address } = body;

    if (!lat && !lng && !zip) {
      return NextResponse.json(
        { error: "Either lat/lng coordinates or zip code is required" },
        { status: 400 }
      );
    }

    console.log(`[Hail Verify] Checking ${zip || `${lat},${lng}`} for hail in last ${days} days`);

    let result;

    if (lat && lng) {
      // Verify by coordinates (more accurate)
      result = await verifyHailAtLocation(
        parseFloat(lat),
        parseFloat(lng),
        parseInt(days)
      );
    } else if (zip) {
      // Verify by zip code
      const reports = await getHailReportsByZip(zip, parseInt(days));
      const hailReports = reports.filter(r => r.report.cat === 'hail');
      
      if (hailReports.length === 0) {
        result = {
          hadHail: false,
          maxHailSize: null,
          reports: [],
          summary: `No hail reports in zip ${zip} in the last ${days} days`
        };
      } else {
        const maxHailSize = Math.max(...hailReports.map(r => r.report.detail.hailIN || 0));
        const mostRecent = hailReports[0];
        
        result = {
          hadHail: true,
          maxHailSize,
          reports: hailReports,
          summary: `${hailReports.length} hail report(s) found near ${zip}. Largest: ${maxHailSize}" hail on ${mostRecent.report.dateTimeISO.split('T')[0]}`
        };
      }
    }

    // Format reports for response
    const formattedReports = result?.reports?.map((r: any) => ({
      date: r.report?.dateTimeISO?.split('T')[0] || 'Unknown',
      time: r.report?.dateTimeISO?.split('T')[1]?.split('-')[0] || '',
      hailSizeInches: r.report?.detail?.hailIN || 0,
      location: `${r.place?.name || ''}, ${r.place?.state?.toUpperCase() || ''}`,
      county: r.place?.county || '',
      coordinates: {
        lat: r.loc?.lat,
        lng: r.loc?.long
      },
      comments: r.report?.comments || ''
    })) || [];

    // Generate damage assessment based on hail size
    let damageAssessment = null;
    if (result?.hadHail && result?.maxHailSize) {
      damageAssessment = assessHailDamage(result.maxHailSize);
    }

    return NextResponse.json({
      success: true,
      verified: result?.hadHail || false,
      location: { lat, lng, zip, address },
      hailData: {
        hadHail: result?.hadHail || false,
        maxHailSize: result?.maxHailSize,
        reportCount: formattedReports.length,
        summary: result?.summary,
        damageAssessment
      },
      reports: formattedReports,
      daysChecked: days,
      source: "xweather",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Hail Verify] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify hail data", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET: Quick check for hail at a location
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const zip = searchParams.get("zip");
  const days = searchParams.get("days") || "90";

  if (!lat && !lng && !zip) {
    return NextResponse.json(
      { error: "lat/lng or zip query param required" },
      { status: 400 }
    );
  }

  try {
    if (lat && lng) {
      const result = await verifyHailAtLocation(
        parseFloat(lat),
        parseFloat(lng),
        parseInt(days)
      );

      return NextResponse.json({
        success: true,
        hadHail: result.hadHail,
        maxHailSize: result.maxHailSize,
        reportCount: result.reports.length,
        summary: result.summary,
        damageAssessment: result.hadHail ? assessHailDamage(result.maxHailSize!) : null
      });
    }

    if (zip) {
      const reports = await getHailReportsByZip(zip, parseInt(days));
      const hailReports = reports.filter(r => r.report.cat === 'hail');
      const maxHailSize = hailReports.length > 0 
        ? Math.max(...hailReports.map(r => r.report.detail.hailIN || 0))
        : null;

      return NextResponse.json({
        success: true,
        hadHail: hailReports.length > 0,
        maxHailSize,
        reportCount: hailReports.length,
        damageAssessment: maxHailSize ? assessHailDamage(maxHailSize) : null
      });
    }
  } catch (error) {
    console.error("[Hail Verify GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to check hail data" },
      { status: 500 }
    );
  }
}

/**
 * Assess potential damage based on hail size
 * Based on NOAA/TORRO hail size damage scale
 */
function assessHailDamage(hailSizeInches: number): {
  severity: string;
  roofDamage: string;
  sidingDamage: string;
  vehicleDamage: string;
  claimLikelihood: string;
  recommendation: string;
} {
  if (hailSizeInches < 0.75) {
    return {
      severity: "minimal",
      roofDamage: "Unlikely - minor granule loss possible",
      sidingDamage: "None expected",
      vehicleDamage: "None expected",
      claimLikelihood: "Low (< 20%)",
      recommendation: "Document property condition. Low priority for inspection."
    };
  }
  
  if (hailSizeInches < 1.0) {
    return {
      severity: "light",
      roofDamage: "Possible granule loss, older roofs at risk",
      sidingDamage: "Minor dents possible on vinyl",
      vehicleDamage: "Possible small dents",
      claimLikelihood: "Moderate (20-40%)",
      recommendation: "Worth scheduling inspection, especially for older roofs (10+ years)."
    };
  }
  
  if (hailSizeInches < 1.5) {
    return {
      severity: "moderate",
      roofDamage: "Likely damage - shingle bruising, mat damage",
      sidingDamage: "Dents on vinyl and aluminum",
      vehicleDamage: "Noticeable dents likely",
      claimLikelihood: "High (40-70%)",
      recommendation: "Schedule inspection ASAP. Strong candidate for roof replacement claim."
    };
  }
  
  if (hailSizeInches < 2.0) {
    return {
      severity: "significant",
      roofDamage: "High probability - cracked shingles, exposed underlayment",
      sidingDamage: "Holes possible in vinyl, significant denting",
      vehicleDamage: "Significant body damage",
      claimLikelihood: "Very High (70-90%)",
      recommendation: "Priority lead - high probability of full roof replacement. Contact immediately."
    };
  }
  
  // 2" or larger
  return {
    severity: "severe",
    roofDamage: "Almost certain - structural damage possible",
    sidingDamage: "Penetration and cracking likely",
    vehicleDamage: "Severe damage, possible broken glass",
    claimLikelihood: "Very High (90%+)",
    recommendation: "URGENT - Top priority lead. Likely extensive property damage requiring immediate inspection."
  };
}
