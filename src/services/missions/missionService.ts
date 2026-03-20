import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

type MissionStatus = "planned" | "in_progress" | "completed" | "cancelled";
type MissionOutcome =
	| "pending"
	| "knocked"
	| "not_home"
	| "not_interested"
	| "appointment_set"
	| "inspection_set"
	| "already_filed"
	| "skipped";

type MissionFilters = {
	status?: MissionStatus;
	assignedRepId?: string;
	aiGenerated?: boolean;
	q?: string;
	limit?: number;
	centerLat?: number;
	centerLng?: number;
	radiusMiles?: number;
};

type MissionUpdateInput = {
	missionId: string;
	action: "start" | "complete" | "cancel" | "update_stop" | "add_stop";
	stopId?: string;
	outcome?: MissionOutcome;
	notes?: string;
	homeownerName?: string;
	homeownerPhone?: string;
	// add_stop
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	lat?: number;
	lng?: number;
};

type MemoryMissionRow = Record<string, unknown>;
type MemoryStopRow = Record<string, unknown>;

const memoryMissionsByUser = new Map<string, MemoryMissionRow[]>();
const memoryStopsByMissionId = new Map<string, MemoryStopRow[]>();
let didWarnMissionFallback = false;

function generateLocalId(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function createMissionClient() {
	if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
		return createAdminClient() as any;
	}
	return (await createServerClient()) as any;
}

function toNumber(value: unknown, fallback = 0): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function toDateString(value: unknown): string | null {
	if (typeof value !== "string" || value.trim().length === 0) return null;
	return value.slice(0, 10);
}

function normalizeUuid(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	const uuidPattern =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidPattern.test(trimmed) ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
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

function hasGeoMissionFilter(filters: MissionFilters): boolean {
	return (
		typeof filters.centerLat === "number" &&
		Number.isFinite(filters.centerLat) &&
		typeof filters.centerLng === "number" &&
		Number.isFinite(filters.centerLng) &&
		typeof filters.radiusMiles === "number" &&
		Number.isFinite(filters.radiusMiles) &&
		filters.radiusMiles > 0
	);
}

function missionDistanceMiles(row: Record<string, unknown>, filters: MissionFilters): number | null {
	if (!hasGeoMissionFilter(filters)) return null;
	const missionLat = toNullableNumber(row.center_lat);
	const missionLng = toNullableNumber(row.center_lng);
	if (missionLat === null || missionLng === null) return null;
	return calculateDistanceMiles(filters.centerLat!, filters.centerLng!, missionLat, missionLng);
}

function missionMatchesGeoFilter(row: Record<string, unknown>, filters: MissionFilters): boolean {
	if (!hasGeoMissionFilter(filters)) return true;
	const distance = missionDistanceMiles(row, filters);
	if (distance === null) return false;
	return distance <= filters.radiusMiles!;
}

function dbErrorMessage(error: unknown, fallback: string): string {
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return fallback;
}

function isMissingMissionSchemaError(error: unknown): boolean {
	const message = dbErrorMessage(error, "");
	if (!message) return false;
	const referencesMissionTables = /canvass_missions|mission_stops/i.test(message);
	const missingSchemaPattern =
		/could not find the table|schema cache|does not exist|relation/i.test(message);
	return referencesMissionTables && missingSchemaPattern;
}

function warnMissionFallbackOnce(error: unknown) {
	if (didWarnMissionFallback) return;
	didWarnMissionFallback = true;
	const message = dbErrorMessage(
		error,
		"Mission tables are unavailable. Falling back to in-memory mission storage."
	);
	console.warn(`[missionsService] ${message}`);
}

function normalizeMission(row: Record<string, unknown>) {
	return {
		id: String(row.id ?? ""),
		name: typeof row.name === "string" ? row.name : "Untitled Mission",
		status: (row.status as MissionStatus) ?? "planned",
		totalStops: toNumber(row.total_stops, 0),
		stopsCompleted: toNumber(row.stops_completed, 0),
		stopsKnocked: toNumber(row.stops_knocked, 0),
		stopsNotHome: toNumber(row.stops_not_home, 0),
		appointmentsSet: toNumber(row.appointments_set, 0),
		leadsCreated: toNumber(row.leads_created, 0),
		estimatedPipeline: toNumber(row.estimated_pipeline, 0),
		scheduledDate: typeof row.scheduled_date === "string" ? row.scheduled_date : null,
		startedAt: typeof row.started_at === "string" ? row.started_at : null,
		completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
		createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
		updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
	};
}

function normalizeMissionStop(row: Record<string, unknown>) {
	return {
		id: String(row.id ?? ""),
		stopOrder: toNumber(row.stop_order, 0),
		address: typeof row.address === "string" ? row.address : "Unknown stop",
		city: typeof row.city === "string" ? row.city : null,
		state: typeof row.state === "string" ? row.state : null,
		zip: typeof row.zip === "string" ? row.zip : null,
		lat: toNumber(row.latitude, 0),
		lng: toNumber(row.longitude, 0),
		ownerName: typeof row.owner_name === "string" ? row.owner_name : null,
		roofAge: row.roof_age === null || row.roof_age === undefined ? null : toNumber(row.roof_age, 0),
		estimatedClaim: toNumber(row.estimated_claim, 0),
		outcome: (row.outcome as MissionOutcome) ?? "pending",
		outcomeNotes: typeof row.outcome_notes === "string" ? row.outcome_notes : null,
		homeownerName: typeof row.homeowner_name === "string" ? row.homeowner_name : null,
		homeownerPhone: typeof row.homeowner_phone === "string" ? row.homeowner_phone : null,
	};
}

function parseStopsInput(input: Record<string, unknown>) {
	const rawStops = Array.isArray(input.stops) ? input.stops : [];
	return rawStops.map((rawStop, index) => {
		const stop = (rawStop ?? {}) as Record<string, unknown>;
		return {
			stop_order: index + 1,
			address:
				typeof stop.address === "string" && stop.address.trim().length > 0
					? stop.address.trim()
					: `Stop ${index + 1}`,
			city: typeof stop.city === "string" ? stop.city : null,
			state: typeof stop.state === "string" ? stop.state : null,
			zip: typeof stop.zip === "string" ? stop.zip : null,
			latitude: toNumber(stop.lat, 0),
			longitude: toNumber(stop.lng, 0),
			owner_name:
				typeof stop.owner_name === "string"
					? stop.owner_name
					: typeof stop.ownerName === "string"
						? stop.ownerName
						: null,
			roof_age:
				stop.roof_age !== undefined
					? toNumber(stop.roof_age, 0)
					: stop.roofAge !== undefined
						? toNumber(stop.roofAge, 0)
						: null,
			estimated_claim:
				stop.estimated_claim !== undefined
					? toNumber(stop.estimated_claim, 0)
					: stop.estimatedClaim !== undefined
						? toNumber(stop.estimatedClaim, 0)
						: 0,
			property_type:
				typeof stop.property_type === "string"
					? stop.property_type
					: typeof stop.propertyType === "string"
						? stop.propertyType
						: null,
			outcome: "pending" as MissionOutcome,
		};
	});
}

function getMemoryMissionRows(userId: string): MemoryMissionRow[] {
	const existing = memoryMissionsByUser.get(userId);
	if (existing) return existing;
	const rows: MemoryMissionRow[] = [];
	memoryMissionsByUser.set(userId, rows);
	return rows;
}

function getMemoryStopRows(missionId: string): MemoryStopRow[] {
	const existing = memoryStopsByMissionId.get(missionId);
	if (existing) return existing;
	const rows: MemoryStopRow[] = [];
	memoryStopsByMissionId.set(missionId, rows);
	return rows;
}

function recalculateMemoryMissionStats(missionRow: MemoryMissionRow, stopRows: MemoryStopRow[]) {
	const totalStops = stopRows.length;
	const stopsCompleted = stopRows.filter((stop) => stop.outcome !== "pending").length;
	const stopsKnocked = stopRows.filter((stop) => stop.outcome === "knocked").length;
	const stopsNotHome = stopRows.filter((stop) => stop.outcome === "not_home").length;
	const stopsNotInterested = stopRows.filter((stop) => stop.outcome === "not_interested").length;
	const appointmentsSet = stopRows.filter(
		(stop) => stop.outcome === "appointment_set" || stop.outcome === "inspection_set"
	).length;
	const inspectionsScheduled = stopRows.filter((stop) => stop.outcome === "inspection_set").length;
	const leadsCreated = stopRows.filter((stop) => Boolean(stop.lead_id)).length;
	const estimatedPipeline = stopRows.reduce(
		(sum: number, stop) => sum + toNumber(stop.estimated_claim, 0),
		0
	);
	const actualPipeline = stopRows
		.filter((stop) => Boolean(stop.lead_id))
		.reduce((sum: number, stop) => sum + toNumber(stop.estimated_claim, 0), 0);

	missionRow.total_stops = totalStops;
	missionRow.stops_completed = stopsCompleted;
	missionRow.stops_knocked = stopsKnocked;
	missionRow.stops_not_home = stopsNotHome;
	missionRow.stops_not_interested = stopsNotInterested;
	missionRow.appointments_set = appointmentsSet;
	missionRow.inspections_scheduled = inspectionsScheduled;
	missionRow.leads_created = leadsCreated;
	missionRow.estimated_pipeline = estimatedPipeline;
	missionRow.actual_pipeline = actualPipeline;
	missionRow.updated_at = new Date().toISOString();

	const shouldAutoComplete =
		missionRow.status !== "cancelled" && totalStops > 0 && stopsCompleted >= totalStops;
	if (shouldAutoComplete) {
		missionRow.status = "completed";
		missionRow.completed_at =
			typeof missionRow.completed_at === "string" ? missionRow.completed_at : new Date().toISOString();
	}
}

function getMissionWithStopsFromMemory(userId: string, missionId: string) {
	const missionRows = getMemoryMissionRows(userId);
	const missionRow = missionRows.find((row) => String(row.id ?? "") === missionId);
	if (!missionRow) {
		throw new Error("Mission not found");
	}
	const stopRows = [...getMemoryStopRows(missionId)].sort(
		(a, b) => toNumber(a.stop_order, 0) - toNumber(b.stop_order, 0)
	);
	return {
		mission: normalizeMission(missionRow),
		stops: stopRows.map((row) => normalizeMissionStop(row)),
	};
}

function listMissionsFromMemory(userId: string, filters: MissionFilters) {
	let rows = [...getMemoryMissionRows(userId)];
	rows = rows.filter((row) => missionMatchesGeoFilter(row, filters));
	if (filters.status) {
		rows = rows.filter((row) => row.status === filters.status);
	}
	if (filters.q && filters.q.trim().length > 0) {
		const query = filters.q.trim().toLowerCase();
		rows = rows.filter((row) =>
			String(row.name ?? "Untitled Mission").toLowerCase().includes(query)
		);
	}
	rows.sort(
		(a, b) => {
			const distanceA = missionDistanceMiles(a, filters);
			const distanceB = missionDistanceMiles(b, filters);
			if (distanceA !== null && distanceB !== null && distanceA !== distanceB) {
				return distanceA - distanceB;
			}
			return (
				new Date(String(b.created_at ?? "")).getTime() -
				new Date(String(a.created_at ?? "")).getTime()
			);
		}
	);
	if (filters.limit && Number.isFinite(filters.limit)) {
		rows = rows.slice(0, filters.limit);
	}
	return rows.map((row) => normalizeMission(row));
}

function createMissionInMemory(userId: string, input: Record<string, unknown>) {
	const now = new Date().toISOString();
	const missionId = generateLocalId("mission");
	const teamId = normalizeUuid(input.teamId);
	const stormEventId = normalizeUuid(input.stormEventId);
	const missionRow: MemoryMissionRow = {
		id: missionId,
		user_id: userId,
		team_id: teamId,
		storm_event_id: stormEventId,
		name:
			typeof input.name === "string" && input.name.trim().length > 0
				? input.name.trim()
				: "Untitled Mission",
		description: typeof input.description === "string" ? input.description : null,
		center_lat: toNumber(input.centerLat, 0),
		center_lng: toNumber(input.centerLng, 0),
		radius_miles: toNumber(input.radiusMiles, 1),
		status: "planned" as MissionStatus,
		scheduled_date: toDateString(input.scheduledDate),
		started_at: null,
		completed_at: null,
		total_stops: 0,
		stops_completed: 0,
		stops_knocked: 0,
		stops_not_home: 0,
		stops_not_interested: 0,
		appointments_set: 0,
		inspections_scheduled: 0,
		leads_created: 0,
		estimated_pipeline: 0,
		actual_pipeline: 0,
		created_at: now,
		updated_at: now,
	};

	const stopRows = parseStopsInput(input).map((stop) => ({
		...stop,
		id: generateLocalId("stop"),
		mission_id: missionId,
		user_id: userId,
		outcome_notes: null,
		homeowner_name: null,
		homeowner_phone: null,
		lead_id: null,
		created_at: now,
		updated_at: now,
	}));

	const missionRows = getMemoryMissionRows(userId);
	missionRows.unshift(missionRow);
	memoryStopsByMissionId.set(missionId, stopRows);
	recalculateMemoryMissionStats(missionRow, stopRows);

	return getMissionWithStopsFromMemory(userId, missionId);
}

function updateMissionInMemory(userId: string, input: MissionUpdateInput) {
	const missionRows = getMemoryMissionRows(userId);
	const missionRow = missionRows.find((row) => String(row.id ?? "") === input.missionId);
	if (!missionRow) {
		throw new Error("Mission not found");
	}

	const stopRows = getMemoryStopRows(input.missionId);
	const now = new Date().toISOString();

	if (input.action === "start") {
		missionRow.status = "in_progress";
		if (typeof missionRow.started_at !== "string") {
			missionRow.started_at = now;
		}
	} else if (input.action === "complete") {
		missionRow.status = "completed";
		missionRow.completed_at = now;
	} else if (input.action === "cancel") {
		missionRow.status = "cancelled";
	} else if (input.action === "update_stop") {
		if (!input.stopId) {
			throw new Error("stopId is required for update_stop");
		}
		const stopRow = stopRows.find((row) => String(row.id ?? "") === input.stopId);
		if (!stopRow) {
			throw new Error("Mission stop not found");
		}
		if (input.outcome) stopRow.outcome = input.outcome;
		if (typeof input.notes === "string") stopRow.outcome_notes = input.notes;
		if (typeof input.homeownerName === "string") stopRow.homeowner_name = input.homeownerName;
		if (typeof input.homeownerPhone === "string") stopRow.homeowner_phone = input.homeownerPhone;
		stopRow.updated_at = now;

		if (
			input.outcome &&
			input.outcome !== "pending" &&
			typeof missionRow.status === "string" &&
			missionRow.status === "planned"
		) {
			missionRow.status = "in_progress";
			if (typeof missionRow.started_at !== "string") {
				missionRow.started_at = now;
			}
		}
	} else if (input.action === "add_stop") {
		const address =
			typeof input.address === "string" && input.address.trim().length > 0
				? input.address.trim()
				: null;
		if (!address) {
			throw new Error("address is required for add_stop");
		}
		const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : 0;
		const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : 0;
		const maxOrder = stopRows.reduce(
			(max, r) => Math.max(max, toNumber(r.stop_order, 0)),
			0
		);
		const newStop: MemoryStopRow = {
			id: generateLocalId("stop"),
			mission_id: input.missionId,
			user_id: userId,
			stop_order: maxOrder + 1,
			address,
			city: typeof input.city === "string" ? input.city : null,
			state: typeof input.state === "string" ? input.state : null,
			zip: typeof input.zip === "string" ? input.zip : null,
			latitude: lat,
			longitude: lng,
			outcome: "pending",
			created_at: now,
			updated_at: now,
		};
		stopRows.push(newStop);
	}

	recalculateMemoryMissionStats(missionRow, stopRows);
	return getMissionWithStopsFromMemory(userId, input.missionId);
}

async function recalculateMissionStats(supabase: any, missionId: string) {
	const { data: stopRows, error: stopError } = await (supabase.from("mission_stops") as any)
		.select("id, outcome, estimated_claim, lead_id")
		.eq("mission_id", missionId);

	if (stopError) {
		throw new Error(dbErrorMessage(stopError, "Failed to recalculate mission stats"));
	}

	const stops = Array.isArray(stopRows) ? stopRows : [];
	const totalStops = stops.length;
	const stopsCompleted = stops.filter((stop) => stop.outcome !== "pending").length;
	const stopsKnocked = stops.filter((stop) => stop.outcome === "knocked").length;
	const stopsNotHome = stops.filter((stop) => stop.outcome === "not_home").length;
	const stopsNotInterested = stops.filter((stop) => stop.outcome === "not_interested").length;
	const appointmentsSet = stops.filter(
		(stop) => stop.outcome === "appointment_set" || stop.outcome === "inspection_set"
	).length;
	const inspectionsScheduled = stops.filter((stop) => stop.outcome === "inspection_set").length;
	const leadsCreated = stops.filter((stop) => stop.lead_id).length;
	const estimatedPipeline = stops.reduce(
		(sum: number, stop: { estimated_claim?: unknown }) => sum + toNumber(stop.estimated_claim, 0),
		0
	);
	const actualPipeline = stops
		.filter((stop) => Boolean(stop.lead_id))
		.reduce(
			(sum: number, stop: { estimated_claim?: unknown }) => sum + toNumber(stop.estimated_claim, 0),
			0
		);

	const { data: missionRow, error: missionError } = await (supabase.from("canvass_missions") as any)
		.select("status, completed_at")
		.eq("id", missionId)
		.single();

	if (missionError) {
		throw new Error(dbErrorMessage(missionError, "Failed to load mission for stats update"));
	}

	const shouldAutoComplete =
		missionRow.status !== "cancelled" && totalStops > 0 && stopsCompleted >= totalStops;

	const patch: Record<string, unknown> = {
		total_stops: totalStops,
		stops_completed: stopsCompleted,
		stops_knocked: stopsKnocked,
		stops_not_home: stopsNotHome,
		stops_not_interested: stopsNotInterested,
		appointments_set: appointmentsSet,
		inspections_scheduled: inspectionsScheduled,
		leads_created: leadsCreated,
		estimated_pipeline: estimatedPipeline,
		actual_pipeline: actualPipeline,
	};

	if (shouldAutoComplete) {
		patch.status = "completed";
		patch.completed_at = missionRow.completed_at ?? new Date().toISOString();
	}

	const { error: updateError } = await (supabase.from("canvass_missions") as any)
		.update(patch)
		.eq("id", missionId);

	if (updateError) {
		throw new Error(dbErrorMessage(updateError, "Failed to persist mission stats"));
	}
}

async function getMissionWithStops(supabase: any, userId: string, missionId: string) {
	const missionSelect =
		"id, name, status, total_stops, stops_completed, stops_knocked, stops_not_home, appointments_set, leads_created, estimated_pipeline, scheduled_date, started_at, completed_at, created_at, updated_at";
	const { data: missionRow, error: missionError } = await (supabase.from("canvass_missions") as any)
		.select(missionSelect)
		.eq("id", missionId)
		.eq("user_id", userId)
		.single();

	if (missionError) {
		throw new Error(dbErrorMessage(missionError, "Failed to load mission"));
	}
	if (!missionRow) {
		throw new Error("Mission not found");
	}

	const { data: stopRows, error: stopError } = await (supabase.from("mission_stops") as any)
		.select(
			"id, stop_order, address, city, state, zip, latitude, longitude, owner_name, roof_age, estimated_claim, outcome, outcome_notes, homeowner_name, homeowner_phone"
		)
		.eq("mission_id", missionId)
		.eq("user_id", userId)
		.order("stop_order", { ascending: true });

	if (stopError) {
		throw new Error(dbErrorMessage(stopError, "Failed to load mission stops"));
	}

	return {
		mission: normalizeMission(missionRow),
		stops: (Array.isArray(stopRows) ? stopRows : []).map((row) => normalizeMissionStop(row)),
	};
}

export const missionsService = {
	async getMission(userId: string, missionId: string) {
		try {
			const supabase = await createMissionClient();
			return await getMissionWithStops(supabase, userId, missionId);
		} catch (error) {
			if (isMissingMissionSchemaError(error)) {
				warnMissionFallbackOnce(error);
				return getMissionWithStopsFromMemory(userId, missionId);
			}
			throw error;
		}
	},

	async listMissions(userId: string, filters: MissionFilters) {
		try {
			const supabase = await createMissionClient();
			const selectColumns =
				"id, name, status, center_lat, center_lng, total_stops, stops_completed, stops_knocked, stops_not_home, appointments_set, leads_created, estimated_pipeline, scheduled_date, started_at, completed_at, created_at, updated_at";
			const useGeoFilter = hasGeoMissionFilter(filters);

			let query = (supabase.from("canvass_missions") as any)
				.select(selectColumns)
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (filters.status) {
				query = query.eq("status", filters.status);
			}
			if (filters.q && filters.q.trim().length > 0) {
				query = query.ilike("name", `%${filters.q.trim()}%`);
			}
			if (useGeoFilter) {
				// Pull a larger window, then apply exact distance filtering in-process.
				query = query.limit(200);
			} else if (filters.limit && Number.isFinite(filters.limit)) {
				query = query.limit(filters.limit);
			}

			const { data, error } = await query;
			if (error) {
				throw new Error(
					dbErrorMessage(error, "Failed to list missions. Ensure canvass mission tables are migrated.")
				);
			}

			let rows = Array.isArray(data) ? data : [];
			if (useGeoFilter) {
				rows = rows.filter((row) => missionMatchesGeoFilter(row, filters));
				rows.sort((a, b) => {
					const distanceA = missionDistanceMiles(a, filters);
					const distanceB = missionDistanceMiles(b, filters);
					if (distanceA !== null && distanceB !== null && distanceA !== distanceB) {
						return distanceA - distanceB;
					}
					return (
						new Date(String(b.created_at ?? "")).getTime() -
						new Date(String(a.created_at ?? "")).getTime()
					);
				});
			}
			if (filters.limit && Number.isFinite(filters.limit)) {
				rows = rows.slice(0, filters.limit);
			}
			return rows.map((row) => normalizeMission(row));
		} catch (error) {
			if (isMissingMissionSchemaError(error)) {
				warnMissionFallbackOnce(error);
				return listMissionsFromMemory(userId, filters);
			}
			throw error;
		}
	},

	async createMission(userId: string, input: Record<string, unknown>) {
		try {
			const supabase = await createMissionClient();
			const stops = parseStopsInput(input);
			const teamId = normalizeUuid(input.teamId);
			const stormEventId = normalizeUuid(input.stormEventId);

			const missionInsert = {
				user_id: userId,
				team_id: teamId,
				storm_event_id: stormEventId,
				name:
					typeof input.name === "string" && input.name.trim().length > 0
						? input.name.trim()
						: "Untitled Mission",
				description: typeof input.description === "string" ? input.description : null,
				center_lat: toNumber(input.centerLat, 0),
				center_lng: toNumber(input.centerLng, 0),
				radius_miles: toNumber(input.radiusMiles, 1),
				status: "planned" as MissionStatus,
				scheduled_date: toDateString(input.scheduledDate),
			};

			const { data: insertedMission, error: missionError } = await (supabase.from("canvass_missions") as any)
				.insert(missionInsert)
				.select("id")
				.single();

			if (missionError || !insertedMission?.id) {
				throw new Error(
					dbErrorMessage(
						missionError,
						"Failed to create mission. Ensure canvass mission tables are migrated."
					)
				);
			}

			if (stops.length > 0) {
				const stopRows = stops.map((stop) => ({
					...stop,
					mission_id: insertedMission.id,
					user_id: userId,
				}));

				const { error: stopError } = await (supabase.from("mission_stops") as any).insert(stopRows);
				if (stopError) {
					throw new Error(dbErrorMessage(stopError, "Failed to create mission stops"));
				}
			}

			await recalculateMissionStats(supabase, insertedMission.id);
			return getMissionWithStops(supabase, userId, insertedMission.id);
		} catch (error) {
			if (isMissingMissionSchemaError(error)) {
				warnMissionFallbackOnce(error);
				return createMissionInMemory(userId, input);
			}
			throw error;
		}
	},

	async updateMission(userId: string, input: MissionUpdateInput) {
		try {
			const supabase = await createMissionClient();
			const now = new Date().toISOString();

			const { data: missionRow, error: missionError } = await (supabase.from("canvass_missions") as any)
				.select("id, status, started_at")
				.eq("id", input.missionId)
				.eq("user_id", userId)
				.single();

			if (missionError) {
				throw new Error(dbErrorMessage(missionError, "Failed to load mission"));
			}
			if (!missionRow?.id) {
				throw new Error("Mission not found");
			}

			if (input.action === "start") {
				const { error } = await (supabase.from("canvass_missions") as any)
					.update({
						status: "in_progress",
						started_at: missionRow.started_at ?? now,
					})
					.eq("id", input.missionId)
					.eq("user_id", userId);

				if (error) {
					throw new Error(dbErrorMessage(error, "Failed to start mission"));
				}
			} else if (input.action === "complete") {
				const { error } = await (supabase.from("canvass_missions") as any)
					.update({
						status: "completed",
						completed_at: now,
					})
					.eq("id", input.missionId)
					.eq("user_id", userId);

				if (error) {
					throw new Error(dbErrorMessage(error, "Failed to complete mission"));
				}
			} else if (input.action === "cancel") {
				const { error } = await (supabase.from("canvass_missions") as any)
					.update({
						status: "cancelled",
					})
					.eq("id", input.missionId)
					.eq("user_id", userId);

				if (error) {
					throw new Error(dbErrorMessage(error, "Failed to cancel mission"));
				}
			} else if (input.action === "update_stop") {
				if (!input.stopId) {
					throw new Error("stopId is required for update_stop");
				}

				const stopPatch: Record<string, unknown> = {};
				if (input.outcome) stopPatch.outcome = input.outcome;
				if (typeof input.notes === "string") stopPatch.outcome_notes = input.notes;
				if (typeof input.homeownerName === "string") stopPatch.homeowner_name = input.homeownerName;
				if (typeof input.homeownerPhone === "string") stopPatch.homeowner_phone = input.homeownerPhone;

				const { error: stopError } = await (supabase.from("mission_stops") as any)
					.update(stopPatch)
					.eq("id", input.stopId)
					.eq("mission_id", input.missionId)
					.eq("user_id", userId);

				if (stopError) {
					throw new Error(dbErrorMessage(stopError, "Failed to update mission stop"));
				}

				if (input.outcome && input.outcome !== "pending" && missionRow.status === "planned") {
					const { error: promoteError } = await (supabase.from("canvass_missions") as any)
						.update({
							status: "in_progress",
							started_at: missionRow.started_at ?? now,
						})
						.eq("id", input.missionId)
						.eq("user_id", userId);

					if (promoteError) {
						throw new Error(dbErrorMessage(promoteError, "Failed to update mission status"));
					}
				}
			} else if (input.action === "add_stop") {
				const address =
					typeof input.address === "string" && input.address.trim().length > 0
						? input.address.trim()
						: null;
				if (!address) {
					throw new Error("address is required for add_stop");
				}
				const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : 0;
				const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : 0;

				const { data: maxRows } = await (supabase.from("mission_stops") as any)
					.select("stop_order")
					.eq("mission_id", input.missionId)
					.order("stop_order", { ascending: false })
					.limit(1);

				const maxOrder = Array.isArray(maxRows) && maxRows[0] ? maxRows[0].stop_order : 0;
				const nextOrder = (typeof maxOrder === "number" ? maxOrder : 0) + 1;
				const newStop = {
					mission_id: input.missionId,
					user_id: userId,
					stop_order: nextOrder,
					address,
					city: typeof input.city === "string" ? input.city : null,
					state: typeof input.state === "string" ? input.state : null,
					zip: typeof input.zip === "string" ? input.zip : null,
					latitude: lat,
					longitude: lng,
					outcome: "pending",
				};

				const { error: insertError } = await (supabase.from("mission_stops") as any).insert(newStop);
				if (insertError) {
					throw new Error(dbErrorMessage(insertError, "Failed to add mission stop"));
				}
			}

			await recalculateMissionStats(supabase, input.missionId);
			return getMissionWithStops(supabase, userId, input.missionId);
		} catch (error) {
			if (isMissingMissionSchemaError(error)) {
				warnMissionFallbackOnce(error);
				return updateMissionInMemory(userId, input);
			}
			throw error;
		}
	},
};
