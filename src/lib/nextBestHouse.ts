import type { MissionStopStatus, NextBestHouseResult, NextBestHouseSuggestion } from "@/types/missions";

export interface NextBestHouseInput {
	currentLat: number;
	currentLng: number;
	remainingStops: MissionCandidate[];
	nearbyUnassigned: UnassignedCandidate[];
	currentTime: string;
	workingHoursEnd: string;
	avgMinutesPerStop: number;
	allowMidMissionAdditions: boolean;
}

export interface MissionCandidate {
	id: string;
	address: string;
	lat: number;
	lng: number;
	opportunityScore: number;
	stormAgeDays: number;
	estimatedValueBand: string;
	attemptCount: number;
	status: MissionStopStatus;
	stormZoneName?: string;
}

export interface UnassignedCandidate {
	targetId: string;
	address: string;
	lat: number;
	lng: number;
	opportunityScore: number;
	stormZoneName: string;
	stormAgeDays: number;
	estimatedValueBand: string;
}

type Candidate = {
	source: "mission_stop" | "unassigned";
	stopId: string | null;
	targetId: string | null;
	address: string;
	lat: number;
	lng: number;
	opportunityScore: number;
	stormZoneName: string;
	stormAgeDays: number;
	estimatedValueBand: string;
	attemptCount: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const earthRadiusMiles = 3958.8;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return earthRadiusMiles * c;
}

function estimatedDriveMinutes(distanceMiles: number): number {
	const avgMph = 28;
	return Math.max(1, Math.round((distanceMiles / avgMph) * 60));
}

function parseTimeToday(timeHHmm: string): Date {
	const [hours, minutes] = timeHHmm.split(":").map((value) => Number(value));
	const date = new Date();
	date.setHours(Number.isFinite(hours) ? hours : 18, Number.isFinite(minutes) ? minutes : 0, 0, 0);
	return date;
}

export function rankNextBestHouse(input: NextBestHouseInput): NextBestHouseResult {
	const candidates: Candidate[] = [
		...input.remainingStops.map((stop) => ({
			source: "mission_stop" as const,
			stopId: stop.id,
			targetId: null,
			address: stop.address,
			lat: stop.lat,
			lng: stop.lng,
			opportunityScore: stop.opportunityScore,
			stormZoneName: stop.stormZoneName || "Assigned Mission",
			stormAgeDays: stop.stormAgeDays,
			estimatedValueBand: stop.estimatedValueBand,
			attemptCount: stop.attemptCount,
		})),
		...(input.allowMidMissionAdditions
			? input.nearbyUnassigned.map((stop) => ({
				source: "unassigned" as const,
				stopId: null,
				targetId: stop.targetId,
				address: stop.address,
				lat: stop.lat,
				lng: stop.lng,
				opportunityScore: stop.opportunityScore,
				stormZoneName: stop.stormZoneName,
				stormAgeDays: stop.stormAgeDays,
				estimatedValueBand: stop.estimatedValueBand,
				attemptCount: 0,
			}))
			: []),
	];

	const now = new Date(input.currentTime);
	const end = parseTimeToday(input.workingHoursEnd);

	const scored = candidates
		.map((candidate) => {
			const distance = haversineMiles(input.currentLat, input.currentLng, candidate.lat, candidate.lng);
			if (distance > 5) {
				return null;
			}

			const driveMinutes = estimatedDriveMinutes(distance);
			const recencyBonus = clamp(1 - candidate.stormAgeDays / 30, 0, 1);
			const proximity = clamp(1 - distance / 5, 0, 1);
			const noReattemptPenalty = candidate.attemptCount <= 0 ? 1 : candidate.attemptCount === 1 ? 0.5 : 0;

			const minutesUntilEnd = (end.getTime() - now.getTime()) / 60000;
			const timeEfficiency = driveMinutes + input.avgMinutesPerStop <= minutesUntilEnd ? 1 : 0;

			const composite =
				(candidate.opportunityScore / 100) * 0.35 +
				proximity * 0.3 +
				recencyBonus * 0.15 +
				timeEfficiency * 0.1 +
				noReattemptPenalty * 0.1;

			const reasons: string[] = [];
			if (candidate.opportunityScore >= 80) {
				reasons.push(`High opportunity score (${candidate.opportunityScore})`);
			}
			if (distance <= 1) {
				reasons.push(`${distance.toFixed(1)} mi away`);
			}
			if (candidate.stormAgeDays <= 7) {
				reasons.push(`Recent storm (${candidate.stormAgeDays}d)`);
			}
			if (reasons.length === 0) {
				reasons.push("Best blended score for route efficiency");
			}

			return {
				candidate,
				distance,
				driveMinutes,
				composite,
				reasons,
			};
		})
		.filter((value): value is NonNullable<typeof value> => Boolean(value))
		.sort((a, b) => b.composite - a.composite)
		.slice(0, 5);

	const suggestions: NextBestHouseSuggestion[] = scored.map((entry, index) => ({
		rank: index + 1,
		source: entry.candidate.source,
		stopId: entry.candidate.stopId,
		targetId: entry.candidate.targetId,
		address: entry.candidate.address,
		lat: entry.candidate.lat,
		lng: entry.candidate.lng,
		distanceMiles: Number(entry.distance.toFixed(2)),
		estimatedDriveMinutes: entry.driveMinutes,
		opportunityScore: entry.candidate.opportunityScore,
		candidateScore: Number((entry.composite * 100).toFixed(2)),
		reasons: entry.reasons,
		stormZoneName: entry.candidate.stormZoneName,
		estimatedValueBand: entry.candidate.estimatedValueBand,
	}));

	const includesUnassigned = suggestions.some((item) => item.source === "unassigned");
	const minutesUntilEnd = Math.max(0, (end.getTime() - now.getTime()) / 60000);
	const estimatedRemainingCapacity = Math.floor(minutesUntilEnd / Math.max(5, input.avgMinutesPerStop));

	return {
		suggestions,
		includesUnassigned,
		estimatedRemainingCapacity,
		generatedAt: new Date().toISOString(),
	};
}
