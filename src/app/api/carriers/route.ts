import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions";

export const runtime = "nodejs";

// Static carrier intelligence data (in production, this would come from a database)
const CARRIER_DATA: Record<string, {
	name: string;
	approvalRate: number;
	avgClaimValue: number;
	commonDenials: string[];
	supplementSuccessRate: number;
	avgResponseTime: string;
	negotiationTips: string[];
	preferredDocumentation: string[];
}> = {
	"state-farm": {
		name: "State Farm",
		approvalRate: 72,
		avgClaimValue: 14500,
		commonDenials: [
			"Pre-existing damage",
			"Maintenance-related wear",
			"Age of roof exceeds coverage",
		],
		supplementSuccessRate: 65,
		avgResponseTime: "7-10 business days",
		negotiationTips: [
			"Document with timestamped photos before and after storm",
			"Reference their own inspection standards",
			"Request re-inspection if initial estimate is low",
		],
		preferredDocumentation: [
			"Dated photo evidence",
			"Manufacturer specifications",
			"Weather reports from NOAA",
		],
	},
	"allstate": {
		name: "Allstate",
		approvalRate: 68,
		avgClaimValue: 12800,
		commonDenials: [
			"Cosmetic damage only",
			"Improper maintenance",
			"Policy exclusions",
		],
		supplementSuccessRate: 58,
		avgResponseTime: "10-14 business days",
		negotiationTips: [
			"Emphasize functional damage over cosmetic",
			"Use their claim representative's name in follow-ups",
			"Request desk adjuster review if field adjuster denies",
		],
		preferredDocumentation: [
			"Detailed scope of work",
			"Code compliance citations",
			"Third-party inspection reports",
		],
	},
	"liberty-mutual": {
		name: "Liberty Mutual",
		approvalRate: 75,
		avgClaimValue: 15200,
		commonDenials: [
			"Wind vs hail damage dispute",
			"Coverage limit reached",
			"Depreciation disputes",
		],
		supplementSuccessRate: 70,
		avgResponseTime: "5-7 business days",
		negotiationTips: [
			"Document wind patterns and hail reports separately",
			"Request itemized depreciation breakdown",
			"Appeal directly to claims manager for large disputes",
		],
		preferredDocumentation: [
			"Weather service hail reports",
			"Material invoices",
			"Contractor certifications",
		],
	},
	"farmers": {
		name: "Farmers Insurance",
		approvalRate: 70,
		avgClaimValue: 13900,
		commonDenials: [
			"Gradual deterioration",
			"Improper installation",
			"Missing maintenance records",
		],
		supplementSuccessRate: 62,
		avgResponseTime: "7-12 business days",
		negotiationTips: [
			"Provide installation records when available",
			"Document with close-up damage photos",
			"Reference state-specific roofing codes",
		],
		preferredDocumentation: [
			"Installation documentation",
			"Maintenance history",
			"Building permit records",
		],
	},
	"usaa": {
		name: "USAA",
		approvalRate: 82,
		avgClaimValue: 16800,
		commonDenials: [
			"Coverage verification delays",
			"Military deployment documentation",
			"Secondary home coverage limits",
		],
		supplementSuccessRate: 78,
		avgResponseTime: "3-5 business days",
		negotiationTips: [
			"USAA typically pays fair - document thoroughly first time",
			"Request military member rate considerations",
			"They respond well to professional, detailed claims",
		],
		preferredDocumentation: [
			"Comprehensive photo documentation",
			"Detailed material lists",
			"Clear timeline of damage",
		],
	},
};

interface CarrierRequest {
	carrier?: string;
	state?: string;
}

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Check feature access
		const access = await checkFeatureAccess(user.id, "carrier_intelligence");
		if (!access.allowed) {
			return NextResponse.json(
				{ error: access.reason, tier: access.tier },
				{ status: 403 }
			);
		}

		const body = (await request.json()) as CarrierRequest;
		const { carrier } = body;

		// If specific carrier requested
		if (carrier) {
			const carrierKey = carrier.toLowerCase().replace(/\s+/g, "-");
			const carrierInfo = CARRIER_DATA[carrierKey];

			if (!carrierInfo) {
				return NextResponse.json(
					{ error: "Carrier not found in database" },
					{ status: 404 }
				);
			}

			// Log usage
			await (supabase.from("feature_usage") as any).insert({
				user_id: user.id,
				feature: "carrier_intelligence",
				metadata: { carrier },
			});

			return NextResponse.json({
				success: true,
				carrier: carrierInfo,
			});
		}

		// Return all carriers summary
		const carrierSummary = Object.entries(CARRIER_DATA).map(([key, data]) => ({
			id: key,
			name: data.name,
			approvalRate: data.approvalRate,
			avgClaimValue: data.avgClaimValue,
			supplementSuccessRate: data.supplementSuccessRate,
		}));

		return NextResponse.json({
			success: true,
			carriers: carrierSummary,
		});
	} catch (error) {
		console.error("Carrier intelligence error:", error);
		return NextResponse.json(
			{ error: "Failed to retrieve carrier data" },
			{ status: 500 }
		);
	}
}
