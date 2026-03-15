import { describe, it, expect } from 'vitest';
import { calculateThreatScore } from '../src/lib/threatScore';

describe('calculateThreatScore', () => {
  it('calculates score with default fallbacks when empty', () => {
    const score = calculateThreatScore({});
    
    // With given defaults and weights from JSON:
    // hail: 0, wind: 0, duration: 0
    // prox(0.5) * 0.15 = 0.075
    // value(0.5) * 0.10 = 0.05
    // age(10 -> 0.5) * 0.10 = 0.05
    // Total rawScore: 0.175
    // Result: 18
    expect(score).toBe(18);
  });

  it('calculates maximum possible score with extreme values', () => {
    const score = calculateThreatScore({
      hailSize: 100, // over 50.8 mm max mapping
      windSpeed: 150, // over 120 mph max mapping
      stormDurationMinutes: 120, // over 60 min max mapping
      proximityScore: 1,
      parcelValueNormalized: 1,
      roofAgeYears: 25 // over 20 years max mapping
    });
    
    // Weights sum up to 1.0 -> score 100
    expect(score).toBe(100);
  });

  it('calculates minimum possible score with 0 risks', () => {
    const score = calculateThreatScore({
      hailSize: 0,
      windSpeed: 0, 
      stormDurationMinutes: 0,
      proximityScore: 0,
      parcelValueNormalized: 0,
      roofAgeYears: 0
    });
    
    expect(score).toBe(0);
  });

  it('correctly calculates a mixed standard threat scenario', () => {
    const score = calculateThreatScore({
      hailSize: 25.4, // 0.5 mapping (1 inch)
      windSpeed: 80,  // (80-40)/80 = 0.5 mapping
      stormDurationMinutes: 30, // 0.5 mapping
      proximityScore: 0.8,
      parcelValueNormalized: 0.2,
      roofAgeYears: 15 // 0.75 mapping
    });
    
    // hail: 0.5 * 0.35 = 0.175
    // wind: 0.5 * 0.20 = 0.10
    // dur: 0.5 * 0.10 = 0.05
    // prox: 0.8 * 0.15 = 0.12
    // val: 0.2 * 0.10 = 0.02
    // age: 0.75 * 0.10 = 0.075
    // Subtotal: 0.54
    // Expect 54
    expect(score).toBe(54);
  });
});
