import { describe, it, expect } from "vitest";
import { scoreOneLead } from "../../src/lib/scoreOneLead";

/**
 * Integration test: batch lead scoring.
 *
 * Uses the pure `scoreOneLead` function exported from the rescore cron
 * endpoint to validate that batch rescoring correctly recomputes
 * `lead_score` from sub-component scores.
 *
 * Does NOT hit a real DB — exercises the deterministic scoring path
 * with fixture data identical to what the cron reads from the leads table.
 */

type LeadFixture = {
  id: string;
  storm_proximity_score: number;
  roof_age_score: number;
  roof_size_score: number;
  property_value_score: number;
  hail_history_score: number;
  lead_score: number; // stale / incorrect score we want to fix
};

function makeLeadFixtures(): LeadFixture[] {
  return [
    {
      id: "lead-1",
      storm_proximity_score: 30,
      roof_age_score: 25,
      roof_size_score: 12,
      property_value_score: 15,
      hail_history_score: 10,
      lead_score: 50, // stale — correct is 92
    },
    {
      id: "lead-2",
      storm_proximity_score: 5,
      roof_age_score: 8,
      roof_size_score: 6,
      property_value_score: 3,
      hail_history_score: 0,
      lead_score: 22, // correct
    },
    {
      id: "lead-3",
      storm_proximity_score: 25,
      roof_age_score: 20,
      roof_size_score: 9,
      property_value_score: 9,
      hail_history_score: 5,
      lead_score: 0, // stale — correct is 68
    },
    {
      id: "lead-4",
      storm_proximity_score: 0,
      roof_age_score: 3,
      roof_size_score: 3,
      property_value_score: 3,
      hail_history_score: 0,
      lead_score: 9, // correct
    },
    {
      id: "lead-5",
      storm_proximity_score: 30,
      roof_age_score: 25,
      roof_size_score: 15,
      property_value_score: 15,
      hail_history_score: 15,
      lead_score: 99, // stale — correct is capped at 100
    },
  ];
}

describe("Lead scoring batch — integration", () => {
  it("correctly recomputes lead_score from sub-components", () => {
    const fixtures = makeLeadFixtures();
    const results: Array<{ id: string; oldScore: number; newScore: number; tier: string }> = [];

    for (const lead of fixtures) {
      const { totalScore, tier } = scoreOneLead({
        stormProximityScore: lead.storm_proximity_score,
        roofAgeScore: lead.roof_age_score,
        roofSizeScore: lead.roof_size_score,
        propertyValueScore: lead.property_value_score,
        hailHistoryScore: lead.hail_history_score,
      });

      results.push({
        id: lead.id,
        oldScore: lead.lead_score,
        newScore: totalScore,
        tier,
      });
    }

    // lead-1: 30+25+12+15+10 = 92
    expect(results[0].newScore).toBe(92);
    expect(results[0].tier).toBe("hot");
    expect(results[0].newScore).not.toBe(results[0].oldScore); // was stale

    // lead-2: 5+8+6+3+0 = 22
    expect(results[1].newScore).toBe(22);
    expect(results[1].tier).toBe("cold");
    expect(results[1].newScore).toBe(results[1].oldScore); // already correct

    // lead-3: 25+20+9+9+5 = 68
    expect(results[2].newScore).toBe(68);
    expect(results[2].tier).toBe("warm");

    // lead-4: 0+3+3+3+0 = 9
    expect(results[3].newScore).toBe(9);
    expect(results[3].tier).toBe("cold");

    // lead-5: 30+25+15+15+15 = 100 (capped)
    expect(results[4].newScore).toBe(100);
    expect(results[4].tier).toBe("hot");
  });

  it("identifies which leads need score updates", () => {
    const fixtures = makeLeadFixtures();
    const stale: string[] = [];

    for (const lead of fixtures) {
      const { totalScore } = scoreOneLead({
        stormProximityScore: lead.storm_proximity_score,
        roofAgeScore: lead.roof_age_score,
        roofSizeScore: lead.roof_size_score,
        propertyValueScore: lead.property_value_score,
        hailHistoryScore: lead.hail_history_score,
      });

      if (totalScore !== lead.lead_score) {
        stale.push(lead.id);
      }
    }

    // 3 of 5 have stale scores
    expect(stale).toEqual(["lead-1", "lead-3", "lead-5"]);
    expect(stale).toHaveLength(3);
  });

  it("caps total score at 100", () => {
    const { totalScore } = scoreOneLead({
      stormProximityScore: 30,
      roofAgeScore: 25,
      roofSizeScore: 15,
      propertyValueScore: 15,
      hailHistoryScore: 15,
    });
    expect(totalScore).toBe(100);

    const over = scoreOneLead({
      stormProximityScore: 35,
      roofAgeScore: 25,
      roofSizeScore: 15,
      propertyValueScore: 15,
      hailHistoryScore: 15,
    });
    // 35+25+15+15+15 = 105 → capped to 100
    expect(over.totalScore).toBe(100);
  });

  it("returns cold tier for zero scores", () => {
    const { totalScore, tier } = scoreOneLead({
      stormProximityScore: 0,
      roofAgeScore: 0,
      roofSizeScore: 0,
      propertyValueScore: 0,
      hailHistoryScore: 0,
    });
    expect(totalScore).toBe(0);
    expect(tier).toBe("cold");
  });

  it("correctly identifies tier boundaries", () => {
    // cold: < 40
    expect(scoreOneLead({ stormProximityScore: 20, roofAgeScore: 15, roofSizeScore: 0, propertyValueScore: 4, hailHistoryScore: 0 }).tier).toBe("cold");

    // moderate: 40-59
    expect(scoreOneLead({ stormProximityScore: 20, roofAgeScore: 15, roofSizeScore: 3, propertyValueScore: 3, hailHistoryScore: 0 }).tier).toBe("moderate");

    // warm: 60-79
    expect(scoreOneLead({ stormProximityScore: 25, roofAgeScore: 20, roofSizeScore: 6, propertyValueScore: 9, hailHistoryScore: 5 }).tier).toBe("warm");

    // hot: >= 80
    expect(scoreOneLead({ stormProximityScore: 30, roofAgeScore: 25, roofSizeScore: 12, propertyValueScore: 9, hailHistoryScore: 5 }).tier).toBe("hot");
  });
});
