// Storm Command Center Types

export type StormEventType = "hail" | "wind" | "tornado" | "mixed";
export type StormSeverity = "minor" | "moderate" | "severe" | "extreme";
export type LeadStatus = "new" | "contacted" | "scheduled" | "inspected" | "quoted" | "sold" | "lost" | "not_interested";
export type LeadTemperature = "hot" | "warm" | "cold";
export type RouteStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type StopStatus = "pending" | "completed" | "skipped" | "not_home" | "callback";
export type StopOutcome = "not_interested" | "callback_scheduled" | "inspection_scheduled" | "already_has_roofer" | "no_damage" | "sold";

export interface StormEvent {
	id: string;
	externalId?: string;
	eventType: StormEventType;
	severity?: StormSeverity;
	hailSizeInches?: number;
	windSpeedMph?: number;
	city?: string;
	state?: string;
	county?: string;
	latitude: number;
	longitude: number;
	radiusMiles: number;
	eventDate: string;
	eventTime?: string;
	source: string;
	rawData?: Record<string, unknown>;
	createdAt: string;
}

export interface ServiceArea {
	id: string;
	userId: string;
	name: string;
	city?: string;
	state?: string;
	zipCodes?: string[];
	radiusMiles: number;
	centerLat?: number;
	centerLng?: number;
	isActive: boolean;
	createdAt: string;
}

export interface StormLead {
	id: string;
	userId: string;
	stormEventId?: string;
	
	// Property
	address: string;
	city?: string;
	state?: string;
	zip?: string;
	latitude?: number;
	longitude?: number;
	
	// Property data
	propertyValue?: number;
	yearBuilt?: number;
	roofAgeYears?: number;
	roofType?: string;
	squareFootage?: number;
	
	// Contact
	ownerName?: string;
	phone?: string;
	email?: string;
	
	// Scoring
	damageProbability?: number;
	leadScore?: number;
	leadTemperature?: LeadTemperature;
	
	// Status
	status: LeadStatus;
	notes?: string;
	
	createdAt: string;
	updatedAt: string;
	
	// Joined data
	stormEvent?: StormEvent;
}

export interface StormRoute {
	id: string;
	userId: string;
	stormEventId?: string;
	name: string;
	status: RouteStatus;
	totalStops: number;
	completedStops: number;
	estimatedDurationMinutes?: number;
	totalDistanceMiles?: number;
	startAddress?: string;
	startLat?: number;
	startLng?: number;
	startedAt?: string;
	completedAt?: string;
	createdAt: string;
	
	// Joined data
	stops?: RouteStop[];
	stormEvent?: StormEvent;
}

export interface RouteStop {
	id: string;
	routeId: string;
	leadId?: string;
	stopOrder: number;
	address: string;
	latitude?: number;
	longitude?: number;
	status: StopStatus;
	outcome?: StopOutcome;
	callbackDate?: string;
	callbackTime?: string;
	notes?: string;
	knockedAt?: string;
	createdAt: string;
	
	// Joined data
	lead?: StormLead;
}

export interface StormAlert {
	id: string;
	userId: string;
	stormEventId?: string;
	serviceAreaId?: string;
	alertType: "storm_detected" | "hail_confirmed" | "leads_ready";
	message?: string;
	isRead: boolean;
	createdAt: string;
}

// API Response types
export interface NOAAStormReport {
	time: string;
	f_scale?: string;
	speed?: number;
	size?: number;
	location: string;
	county: string;
	state: string;
	lat: number;
	lon: number;
	comments?: string;
}

export interface WeatherAlert {
	id: string;
	event: string;
	headline: string;
	description: string;
	severity: string;
	urgency: string;
	areas: string[];
	onset: string;
	expires: string;
}

// UI State types
export interface MapBounds {
	north: number;
	south: number;
	east: number;
	west: number;
}

export interface MapMarker {
	id: string;
	lat: number;
	lng: number;
	type: "storm" | "lead" | "stop";
	data: StormEvent | StormLead | RouteStop;
}
