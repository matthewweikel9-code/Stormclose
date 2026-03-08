// Lead Generation & Scoring
// Generates and scores leads from storm-affected areas

import { StormLead, StormEvent, LeadTemperature } from "./types";
import { calculateDistance } from "./weather-client";

interface PropertyData {
	address: string;
	city: string;
	state: string;
	zip: string;
	latitude: number;
	longitude: number;
	propertyValue?: number;
	yearBuilt?: number;
	squareFootage?: number;
	roofType?: string;
}

/**
 * Calculate damage probability based on storm and property data
 */
export function calculateDamageProbability(
	storm: StormEvent,
	property: PropertyData
): number {
	let probability = 50; // Base probability
	
	// Distance from storm center (closer = higher probability)
	const distance = calculateDistance(
		storm.latitude, storm.longitude,
		property.latitude, property.longitude
	);
	
	if (distance <= 1) probability += 30;
	else if (distance <= 3) probability += 20;
	else if (distance <= 5) probability += 10;
	else if (distance > 10) probability -= 20;
	
	// Storm severity
	switch (storm.severity) {
		case "extreme": probability += 25; break;
		case "severe": probability += 15; break;
		case "moderate": probability += 5; break;
		case "minor": probability -= 10; break;
	}
	
	// Hail size factor
	if (storm.hailSizeInches) {
		if (storm.hailSizeInches >= 2.0) probability += 20;
		else if (storm.hailSizeInches >= 1.5) probability += 15;
		else if (storm.hailSizeInches >= 1.0) probability += 10;
	}
	
	// Wind speed factor
	if (storm.windSpeedMph) {
		if (storm.windSpeedMph >= 80) probability += 20;
		else if (storm.windSpeedMph >= 65) probability += 10;
	}
	
	// Roof age factor (older roofs more vulnerable)
	if (property.yearBuilt) {
		const roofAge = new Date().getFullYear() - property.yearBuilt;
		if (roofAge >= 20) probability += 15;
		else if (roofAge >= 15) probability += 10;
		else if (roofAge >= 10) probability += 5;
		else if (roofAge < 5) probability -= 10;
	}
	
	// Roof type factor
	if (property.roofType) {
		const vulnerable = ["3-tab", "wood shake", "slate", "tile"];
		const durable = ["metal", "impact resistant", "architectural"];
		
		if (vulnerable.some(t => property.roofType?.toLowerCase().includes(t))) {
			probability += 10;
		}
		if (durable.some(t => property.roofType?.toLowerCase().includes(t))) {
			probability -= 10;
		}
	}
	
	// Clamp to 0-100
	return Math.max(0, Math.min(100, probability));
}

/**
 * Calculate overall lead score (likelihood to close)
 */
export function calculateLeadScore(
	damageProbability: number,
	property: PropertyData
): number {
	let score = damageProbability; // Start with damage probability
	
	// Property value factor (higher value = more likely to file claim)
	if (property.propertyValue) {
		if (property.propertyValue >= 500000) score += 15;
		else if (property.propertyValue >= 300000) score += 10;
		else if (property.propertyValue >= 200000) score += 5;
		else if (property.propertyValue < 100000) score -= 10;
	}
	
	// Square footage (larger homes = bigger jobs)
	if (property.squareFootage) {
		if (property.squareFootage >= 3000) score += 10;
		else if (property.squareFootage >= 2000) score += 5;
	}
	
	// Clamp to 0-100
	return Math.max(0, Math.min(100, score));
}

/**
 * Determine lead temperature from score
 */
export function getLeadTemperature(score: number): LeadTemperature {
	if (score >= 70) return "hot";
	if (score >= 40) return "warm";
	return "cold";
}

/**
 * Generate leads from storm event and property list
 */
export function generateLeadsFromStorm(
	storm: StormEvent,
	properties: PropertyData[],
	userId: string
): Omit<StormLead, "id" | "createdAt" | "updatedAt">[] {
	return properties.map(property => {
		const damageProbability = calculateDamageProbability(storm, property);
		const leadScore = calculateLeadScore(damageProbability, property);
		const leadTemperature = getLeadTemperature(leadScore);
		
		return {
			userId,
			stormEventId: storm.id,
			address: property.address,
			city: property.city,
			state: property.state,
			zip: property.zip,
			latitude: property.latitude,
			longitude: property.longitude,
			propertyValue: property.propertyValue,
			yearBuilt: property.yearBuilt,
			squareFootage: property.squareFootage,
			roofType: property.roofType,
			damageProbability,
			leadScore,
			leadTemperature,
			status: "new" as const
		};
	});
}

/**
 * Sort leads by score (highest first)
 */
export function sortLeadsByScore(leads: StormLead[]): StormLead[] {
	return [...leads].sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0));
}

/**
 * Filter leads by temperature
 */
export function filterLeadsByTemperature(
	leads: StormLead[],
	temperature: LeadTemperature
): StormLead[] {
	return leads.filter(lead => lead.leadTemperature === temperature);
}

/**
 * Get lead statistics
 */
export function getLeadStats(leads: StormLead[]) {
	const total = leads.length;
	const hot = leads.filter(l => l.leadTemperature === "hot").length;
	const warm = leads.filter(l => l.leadTemperature === "warm").length;
	const cold = leads.filter(l => l.leadTemperature === "cold").length;
	
	const avgScore = total > 0 
		? leads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / total 
		: 0;
	
	const avgDamageProbability = total > 0
		? leads.reduce((sum, l) => sum + (l.damageProbability || 0), 0) / total
		: 0;
	
	const totalPropertyValue = leads.reduce(
		(sum, l) => sum + (l.propertyValue || 0), 0
	);
	
	return {
		total,
		hot,
		warm,
		cold,
		avgScore: Math.round(avgScore),
		avgDamageProbability: Math.round(avgDamageProbability),
		totalPropertyValue
	};
}

/**
 * Estimate potential revenue from leads
 * Based on average roofing job values
 */
export function estimatePotentialRevenue(leads: StormLead[]): {
	conservative: number;
	moderate: number;
	optimistic: number;
} {
	// Average roofing job: $8,000 - $15,000
	// Close rate assumptions by temperature
	const closeRates = { hot: 0.25, warm: 0.10, cold: 0.03 };
	const avgJobValue = 12000;
	
	let expectedCloses = 0;
	leads.forEach(lead => {
		const temp = lead.leadTemperature || "cold";
		expectedCloses += closeRates[temp];
	});
	
	return {
		conservative: Math.round(expectedCloses * avgJobValue * 0.7),
		moderate: Math.round(expectedCloses * avgJobValue),
		optimistic: Math.round(expectedCloses * avgJobValue * 1.5)
	};
}
