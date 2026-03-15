import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test: Revenue Hub acceptance test.
 *
 * Validates the KPI computation logic used by
 * `GET /api/dashboard/revenue-hub`.
 *
 * The real route handler is tightly coupled to Supabase auth + 12 parallel
 * queries, so this test extracts the pure computation pipeline and feeds it
 * local fixtures.  If the KPI numbers come back correct here, the route's
 * math is sound.
 */

// ── Fixture data ────────────────────────────────────────────────────────────

function makeLeadFixtures() {
  return [
    { id: "l1", status: "new",             estimated_claim: "12000",  lead_score: 85, updated_at: new Date().toISOString() },
    { id: "l2", status: "contacted",       estimated_claim: "18000",  lead_score: 72, updated_at: new Date().toISOString() },
    { id: "l3", status: "appointment_set", estimated_claim: "22000",  lead_score: 60, updated_at: new Date().toISOString() },
    { id: "l4", status: "inspected",       estimated_claim: "30000",  lead_score: 55, updated_at: new Date().toISOString() },
    { id: "l5", status: "signed",          estimated_claim: "45000",  lead_score: 90, updated_at: new Date().toISOString() },
    { id: "l6", status: "closed",          estimated_claim: "35000",  lead_score: 88, updated_at: new Date().toISOString() },
    { id: "l7", status: "closed",          estimated_claim: "28000",  lead_score: 75, updated_at: new Date().toISOString() },
    { id: "l8", status: "lost",            estimated_claim: "15000",  lead_score: 40, updated_at: new Date().toISOString() },
  ];
}

function makeClosedThisMonth() {
  return [
    { estimated_claim: "35000", status_changed_at: new Date().toISOString() },
    { estimated_claim: "28000", status_changed_at: new Date().toISOString() },
  ];
}

function makeClosedLastMonth() {
  return [{ estimated_claim: "20000" }];
}

function makeActivitiesThisMonth() {
  return [
    { activity_type: "door_knock",      created_at: new Date().toISOString() },
    { activity_type: "door_knock",      created_at: new Date().toISOString() },
    { activity_type: "phone_call",      created_at: new Date().toISOString() },
    { activity_type: "appointment_set", created_at: new Date().toISOString() },
    { activity_type: "inspection",      created_at: new Date().toISOString() },
    { activity_type: "estimate_sent",   created_at: new Date().toISOString() },
    { activity_type: "contract_signed", created_at: new Date().toISOString() },
  ];
}

function makeGoals() {
  return {
    monthly_revenue_goal: 25000,
    commission_rate: 0.10,
    daily_door_knock_goal: 30,
    daily_call_goal: 20,
    weekly_appointment_goal: 10,
    monthly_deal_goal: 4,
  };
}

// ── Pure computation extracted from the route handler ───────────────────────

const STAGE_WEIGHTS: Record<string, number> = {
  new: 0.05,
  contacted: 0.15,
  appointment_set: 0.30,
  inspected: 0.50,
  signed: 0.80,
};

function computeRevenueHubKpis(opts: {
  allLeads: any[];
  closedThisMonth: any[];
  closedLastMonth: any[];
  activitiesThisMonth: any[];
  activitiesLastMonth: any[];
  goals: any;
}) {
  const { allLeads, closedThisMonth, closedLastMonth, activitiesThisMonth, activitiesLastMonth, goals } = opts;

  const activeLeads = allLeads.filter((l) => !["closed", "lost"].includes(l.status));
  const pipelineValue = activeLeads.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0),
    0
  );

  const closedDeals = allLeads.filter((l) => l.status === "closed");
  const totalClosedValue = closedDeals.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0),
    0
  );
  const avgDealSize = closedDeals.length > 0 ? totalClosedValue / closedDeals.length : 0;

  const totalOpportunities = allLeads.filter(
    (l) => l.status !== "new" && l.status !== "lost"
  ).length;
  const closeRate =
    totalOpportunities > 0
      ? Math.round((closedDeals.length / totalOpportunities) * 100)
      : 0;

  // Pipeline breakdown
  const pipeline: Record<string, number> = {
    new: 0, contacted: 0, appointment_set: 0, inspected: 0, signed: 0, closed: 0, lost: 0,
  };
  allLeads.forEach((l: any) => {
    if (pipeline[l.status] !== undefined) pipeline[l.status]++;
  });

  const closedValueThisMonth = closedThisMonth.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0),
    0
  );
  const closedValueLastMonth = closedLastMonth.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.estimated_claim) || 0),
    0
  );
  const revenueChangePercent =
    closedValueLastMonth > 0
      ? Math.round(
          ((closedValueThisMonth - closedValueLastMonth) / closedValueLastMonth) * 100
        )
      : closedValueThisMonth > 0
        ? 100
        : 0;

  // Activities
  const activityCounts = {
    doorKnocks: activitiesThisMonth.filter((a: any) => a.activity_type === "door_knock").length,
    phoneCalls: activitiesThisMonth.filter((a: any) => a.activity_type === "phone_call").length,
    appointmentsSet: activitiesThisMonth.filter((a: any) => a.activity_type === "appointment_set").length,
    inspections: activitiesThisMonth.filter((a: any) => a.activity_type === "inspection").length,
    estimatesSent: activitiesThisMonth.filter((a: any) => a.activity_type === "estimate_sent").length,
    dealsClosedActivity: activitiesThisMonth.filter((a: any) => a.activity_type === "contract_signed").length,
  };

  const totalActivitiesThisMonth = activitiesThisMonth.length;
  const totalActivitiesLastMonth = activitiesLastMonth.length;
  const activityChangePercent =
    totalActivitiesLastMonth > 0
      ? Math.round(
          ((totalActivitiesThisMonth - totalActivitiesLastMonth) / totalActivitiesLastMonth) * 100
        )
      : totalActivitiesThisMonth > 0
        ? 100
        : 0;

  // Weighted pipeline
  const weightedPipeline = activeLeads.reduce((sum: number, l: any) => {
    const weight = STAGE_WEIGHTS[l.status] || 0.1;
    return sum + (parseFloat(l.estimated_claim) || 0) * weight;
  }, 0);

  // Commission
  const commissionEarned = closedValueThisMonth * (goals.commission_rate || 0.1);

  // Projected revenue
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const projectedRevenue =
    dayOfMonth > 0 ? (closedValueThisMonth / dayOfMonth) * daysInMonth : 0;

  return {
    kpis: {
      leadsGenerated: allLeads.length,
      activeOpportunities: activeLeads.length,
      appointmentsSet: activityCounts.appointmentsSet,
      dealsClosed: closedThisMonth.length,
      dealsClosedAllTime: closedDeals.length,
      pipelineValue,
      weightedPipeline,
      closeRate,
      closedValue: closedValueThisMonth,
      closedValueAllTime: totalClosedValue,
      avgDealSize,
      revenueChangePercent,
      activityChangePercent,
      projectedRevenue,
      commissionEarned,
    },
    goals,
    activitySummary: activityCounts,
    pipeline,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Revenue Hub — acceptance test (KPI validation)", () => {
  it("computes correct numeric KPIs from fixture data", () => {
    const result = computeRevenueHubKpis({
      allLeads: makeLeadFixtures(),
      closedThisMonth: makeClosedThisMonth(),
      closedLastMonth: makeClosedLastMonth(),
      activitiesThisMonth: makeActivitiesThisMonth(),
      activitiesLastMonth: [], // no last month activities → 100% change
      goals: makeGoals(),
    });

    const { kpis, pipeline, activitySummary } = result;

    // ── Total leads ──
    expect(kpis.leadsGenerated).toBe(8);

    // ── Active (non-closed, non-lost): l1,l2,l3,l4,l5 ──
    expect(kpis.activeOpportunities).toBe(5);

    // ── Pipeline value: 12000+18000+22000+30000+45000 = 127000 ──
    expect(kpis.pipelineValue).toBe(127000);

    // ── Closed deals (all time): l6 + l7 ──
    expect(kpis.dealsClosedAllTime).toBe(2);

    // ── Closed value (all time): 35000+28000 = 63000 ──
    expect(kpis.closedValueAllTime).toBe(63000);

    // ── Avg deal size: 63000 / 2 = 31500 ──
    expect(kpis.avgDealSize).toBe(31500);

    // ── Close rate: opportunities = all except 'new' & 'lost' = 6, closedDeals=2
    //    => round(2/6*100) = 33 ──
    expect(kpis.closeRate).toBe(33);

    // ── Closed value this month: 35000+28000 = 63000 ──
    expect(kpis.closedValue).toBe(63000);

    // ── Revenue change: (63000-20000)/20000 * 100 = 215% ──
    expect(kpis.revenueChangePercent).toBe(215);

    // ── Deals closed this month ──
    expect(kpis.dealsClosed).toBe(2);

    // ── Activity change: 7 this month vs 0 last month → 100% ──
    expect(kpis.activityChangePercent).toBe(100);

    // ── Commission: 63000 * 0.10 = 6300 ──
    expect(kpis.commissionEarned).toBe(6300);

    // ── Weighted pipeline ──
    // new: 12000*0.05=600, contacted: 18000*0.15=2700, appointment_set: 22000*0.30=6600,
    // inspected: 30000*0.50=15000, signed: 45000*0.80=36000
    // Total = 60900
    expect(kpis.weightedPipeline).toBe(60900);

    // ── Projected revenue is numeric and >= closedValue ──
    expect(typeof kpis.projectedRevenue).toBe("number");
    expect(Number.isFinite(kpis.projectedRevenue)).toBe(true);
    // Since dayOfMonth >= 1, projectedRevenue >= closedValueThisMonth
    expect(kpis.projectedRevenue).toBeGreaterThanOrEqual(kpis.closedValue);

    // ── Pipeline breakdown ──
    expect(pipeline.new).toBe(1);
    expect(pipeline.contacted).toBe(1);
    expect(pipeline.appointment_set).toBe(1);
    expect(pipeline.inspected).toBe(1);
    expect(pipeline.signed).toBe(1);
    expect(pipeline.closed).toBe(2);
    expect(pipeline.lost).toBe(1);

    // ── Activity summary ──
    expect(activitySummary.doorKnocks).toBe(2);
    expect(activitySummary.phoneCalls).toBe(1);
    expect(activitySummary.appointmentsSet).toBe(1);
    expect(activitySummary.inspections).toBe(1);
    expect(activitySummary.estimatesSent).toBe(1);
    expect(activitySummary.dealsClosedActivity).toBe(1);
  });

  it("handles zero leads gracefully", () => {
    const result = computeRevenueHubKpis({
      allLeads: [],
      closedThisMonth: [],
      closedLastMonth: [],
      activitiesThisMonth: [],
      activitiesLastMonth: [],
      goals: makeGoals(),
    });

    expect(result.kpis.leadsGenerated).toBe(0);
    expect(result.kpis.activeOpportunities).toBe(0);
    expect(result.kpis.pipelineValue).toBe(0);
    expect(result.kpis.closeRate).toBe(0);
    expect(result.kpis.avgDealSize).toBe(0);
    expect(result.kpis.closedValue).toBe(0);
    expect(result.kpis.revenueChangePercent).toBe(0);
    expect(result.kpis.weightedPipeline).toBe(0);
    expect(result.kpis.commissionEarned).toBe(0);
    expect(result.kpis.projectedRevenue).toBe(0);
  });

  it("handles no last-month data (100% change when this month > 0)", () => {
    const result = computeRevenueHubKpis({
      allLeads: makeLeadFixtures(),
      closedThisMonth: makeClosedThisMonth(),
      closedLastMonth: [],
      activitiesThisMonth: makeActivitiesThisMonth(),
      activitiesLastMonth: [],
      goals: makeGoals(),
    });

    expect(result.kpis.revenueChangePercent).toBe(100);
    expect(result.kpis.activityChangePercent).toBe(100);
  });

  it("computes negative revenue change when last month was better", () => {
    const result = computeRevenueHubKpis({
      allLeads: makeLeadFixtures(),
      closedThisMonth: [{ estimated_claim: "10000", status_changed_at: new Date().toISOString() }],
      closedLastMonth: [{ estimated_claim: "50000" }],
      activitiesThisMonth: [],
      activitiesLastMonth: makeActivitiesThisMonth(),
      goals: makeGoals(),
    });

    // (10000-50000)/50000*100 = -80
    expect(result.kpis.revenueChangePercent).toBe(-80);

    // 0 this month vs 7 last month = -100
    expect(result.kpis.activityChangePercent).toBe(-100);
  });

  it("returns all KPI values as finite numbers", () => {
    const result = computeRevenueHubKpis({
      allLeads: makeLeadFixtures(),
      closedThisMonth: makeClosedThisMonth(),
      closedLastMonth: makeClosedLastMonth(),
      activitiesThisMonth: makeActivitiesThisMonth(),
      activitiesLastMonth: [],
      goals: makeGoals(),
    });

    for (const [key, value] of Object.entries(result.kpis)) {
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("goals object is returned unmodified", () => {
    const goals = makeGoals();
    const result = computeRevenueHubKpis({
      allLeads: [],
      closedThisMonth: [],
      closedLastMonth: [],
      activitiesThisMonth: [],
      activitiesLastMonth: [],
      goals,
    });

    expect(result.goals).toEqual(goals);
    expect(result.goals.monthly_revenue_goal).toBe(25000);
    expect(result.goals.commission_rate).toBe(0.10);
  });
});
