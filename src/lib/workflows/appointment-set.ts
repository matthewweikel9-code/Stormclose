/**
 * Appointment Set workflow orchestrator.
 * Runs estimate, materials, xactimate steps and aggregates for CRM sync.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchRoofDataForNotes } from "@/lib/solar/solarApi";
import {
  calculateEstimate,
  estimateFromDamageReport,
  type RoofMeasurements,
  type EstimateResult,
} from "@/lib/estimate-engine";

export interface AppointmentSetPayload {
  stopId: string;
  missionId: string;
  userId: string;
  address: string;
  lat: number;
  lng: number;
  correlationId: string;
}

export interface WorkflowStepOutput {
  estimate?: EstimateResult & { roofSquares?: number };
  materials?: { bomText: string; shingleBundles: number; underlaymentRolls: number };
  xactimatePacket?: { scope: string; lineItems: string };
}

/** Shape sent to JobNimbus export (matches API / client packet). */
export interface CrmWorkflowPacket {
  estimate?: { costRange?: { low: number; high: number }; roofSquares?: number };
  materials?: { bomText?: string };
  xactimatePacket?: { scope?: string; lineItems?: string };
}

const IDEMPOTENCY_KEY = "appointment_set_v1";

/** True when estimate, materials BOM, and Xactimate (scope or line items) are all present for CRM notes. */
export function isCrmWorkflowPacketComplete(p?: CrmWorkflowPacket | null): boolean {
  const hasXactimate =
    (typeof p?.xactimatePacket?.scope === "string" && p.xactimatePacket.scope.trim().length > 0) ||
    (typeof p?.xactimatePacket?.lineItems === "string" && p.xactimatePacket.lineItems.trim().length > 0);
  return !!(
    p?.estimate?.costRange &&
    typeof p.materials?.bomText === "string" &&
    p.materials.bomText.trim().length > 0 &&
    hasXactimate
  );
}

/** Map DB workflow payload to CRM packet. */
export function workflowStepOutputToCrmPacket(step: WorkflowStepOutput): CrmWorkflowPacket {
  return {
    estimate: step.estimate
      ? { costRange: step.estimate.costRange, roofSquares: step.estimate.roofSquares }
      : undefined,
    materials: step.materials?.bomText ? { bomText: step.materials.bomText } : undefined,
    xactimatePacket: step.xactimatePacket
      ? { scope: step.xactimatePacket.scope, lineItems: step.xactimatePacket.lineItems }
      : undefined,
  };
}

/**
 * Merge client packet with DB output. Fills missing sections (fixes partial JSON with only estimate).
 */
export function mergeCrmWorkflowPackets(
  fromClient: CrmWorkflowPacket | undefined,
  fromDb: WorkflowStepOutput | null
): CrmWorkflowPacket {
  const db = fromDb ? workflowStepOutputToCrmPacket(fromDb) : {};
  return {
    estimate: fromClient?.estimate?.costRange ? fromClient.estimate : db.estimate,
    materials:
      fromClient?.materials?.bomText && fromClient.materials.bomText.length > 0
        ? fromClient.materials
        : db.materials,
    xactimatePacket:
      (fromClient?.xactimatePacket?.scope && fromClient.xactimatePacket.scope.trim().length > 0) ||
      (fromClient?.xactimatePacket?.lineItems && fromClient.xactimatePacket.lineItems.trim().length > 0)
        ? fromClient.xactimatePacket
        : db.xactimatePacket,
  };
}

/**
 * Merge completed workflow_step_runs payloads into base output (fixes runs where
 * workflow_runs.payload was never fully written but steps succeeded).
 */
async function mergeStepPayloadsIntoOutput(
  supabase: { from: (t: string) => any },
  workflowRunId: string,
  base: WorkflowStepOutput
): Promise<WorkflowStepOutput> {
  const { data: steps } = await (supabase as any)
    .from("workflow_step_runs")
    .select("step, status, payload")
    .eq("workflow_run_id", workflowRunId)
    .eq("status", "completed");

  const out: WorkflowStepOutput = { ...base };
  for (const s of steps || []) {
    const pl = s.payload;
    if (!pl || typeof pl !== "object") continue;
    if (s.step === "estimate.run" && !out.estimate) {
      out.estimate = pl as WorkflowStepOutput["estimate"];
    }
    if (s.step === "materials.run" && !(out.materials?.bomText && String(out.materials.bomText).trim())) {
      out.materials = pl as WorkflowStepOutput["materials"];
    }
    if (s.step === "xactimate.packet") {
      const cur = out.xactimatePacket;
      const hasScope = !!(cur?.scope && String(cur.scope).trim());
      const hasLines = !!(cur?.lineItems && String(cur.lineItems).trim());
      if (!hasScope && !hasLines) {
        out.xactimatePacket = pl as WorkflowStepOutput["xactimatePacket"];
      }
    }
  }
  return out;
}

/**
 * Fetch workflow output (estimate, materials, xactimate) for a stop.
 * Returns the payload from the latest completed/partial run, or null if none exists.
 * Fills missing sections from workflow_step_runs when the parent payload JSON is partial.
 */
export async function getWorkflowOutputForStop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stopId: string
): Promise<WorkflowStepOutput | null> {
  try {
    const key = `${userId}:${stopId}:${IDEMPOTENCY_KEY}`;
    const { data, error } = await (supabase as any)
      .from("workflow_runs")
      .select("id, payload")
      .eq("correlation_id", key)
      .eq("source_type", "mission_stop")
      .eq("source_id", stopId)
      .eq("user_id", userId)
      .in("status", ["completed", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) return null;
    const p = (data.payload || {}) as Record<string, unknown>;
    let merged: WorkflowStepOutput = {
      estimate: p.estimate as WorkflowStepOutput["estimate"],
      materials: p.materials as WorkflowStepOutput["materials"],
      xactimatePacket: p.xactimatePacket as WorkflowStepOutput["xactimatePacket"],
    };
    if (!merged.estimate && !merged.materials && !merged.xactimatePacket) {
      merged = await mergeStepPayloadsIntoOutput(supabase, data.id, {});
    } else {
      merged = await mergeStepPayloadsIntoOutput(supabase, data.id, merged);
    }
    if (!merged.estimate && !merged.materials && !merged.xactimatePacket) return null;
    return merged;
  } catch {
    return null;
  }
}

/**
 * Check if we already ran this workflow (idempotency).
 */
export async function getExistingWorkflowRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stopId: string
): Promise<{ id: string; status: string } | null> {
  const key = `${userId}:${stopId}:${IDEMPOTENCY_KEY}`;
  const { data } = await (supabase as any)
    .from("workflow_runs")
    .select("id, status")
    .eq("correlation_id", key)
    .eq("source_type", "mission_stop")
    .eq("source_id", stopId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Create workflow run and run steps. Returns aggregated output for CRM.
 */
export async function runAppointmentSetWorkflow(
  payload: AppointmentSetPayload
): Promise<{ workflowRunId: string; output: WorkflowStepOutput; errors: string[] }> {
  const supabase = await createClient();
  const { stopId, missionId, userId, address, lat, lng, correlationId } = payload;
  const errors: string[] = [];
  const output: WorkflowStepOutput = {};

  const key = `${userId}:${stopId}:${IDEMPOTENCY_KEY}`;

  // Create workflow run
  const { data: run, error: runError } = await (supabase as any)
    .from("workflow_runs")
    .insert({
      correlation_id: key,
      source_type: "mission_stop",
      source_id: stopId,
      user_id: userId,
      status: "running",
      payload: { missionId, address, lat, lng },
    })
    .select("id")
    .single();

  if (runError || !run?.id) {
    throw new Error(runError?.message || "Failed to create workflow run");
  }
  const workflowRunId = run.id;

  // Step 1: estimate.run
  let stepEstimateId: string | null = null;
  try {
    const { data: stepRow } = await (supabase as any)
      .from("workflow_step_runs")
      .insert({
        workflow_run_id: workflowRunId,
        step: "estimate.run",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    stepEstimateId = stepRow?.id;

    const fullAddress = address || `${lat},${lng}`;
    const roofData = await fetchRoofDataForNotes(fullAddress, lat, lng);

    let estimateResult: EstimateResult;
    let roofSquares: number | undefined;

    if (roofData) {
      const segCount = Math.max(1, roofData.facetCount);
      const segArea = roofData.totalAreaSqFt / segCount;
      const measurements: RoofMeasurements = {
        totalAreaSqFt: roofData.totalAreaSqFt,
        totalSquares: roofData.totalSquares,
        groundAreaSqFt: roofData.totalAreaSqFt,
        avgPitchDegrees: roofData.avgPitchDegrees,
        facetCount: roofData.facetCount,
        segments: Array.from({ length: segCount }, () => ({
          areaSqFt: segArea,
          pitchDegrees: roofData.avgPitchDegrees,
          azimuthDegrees: 0,
        })),
      };
      estimateResult = calculateEstimate(measurements);
      roofSquares = roofData.totalSquares;
    } else {
      estimateResult = estimateFromDamageReport({
        estimatedAffectedSquares: 25,
        repairScope: "full_replacement",
      });
      roofSquares = 25;
    }

    output.estimate = { ...estimateResult, roofSquares };

    await (supabase as any)
      .from("workflow_step_runs")
      .update({
        status: "completed",
        payload: output.estimate,
        completed_at: new Date().toISOString(),
      })
      .eq("id", stepEstimateId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Estimate step failed";
    errors.push(`estimate: ${msg}`);
    if (stepEstimateId) {
      await (supabase as any)
        .from("workflow_step_runs")
        .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
        .eq("id", stepEstimateId);
    }
  }

  // Step 2: materials.run (extend estimate to BOM text)
  // Compute payload first so we never lose it if DB insert/update fails
  const estForMats = output.estimate;
  const mats = estForMats?.materials ?? {
    shingleBundles: 75,
    underlaymentRolls: 20,
    ridgeCapBundles: 10,
    dripEdgeFeet: 200,
  } as EstimateResult["materials"];
  const bomText = [
    `--- Materials BOM ---`,
    `Shingle bundles: ${mats.shingleBundles}`,
    `Underlayment rolls: ${mats.underlaymentRolls}`,
    `Ridge cap bundles: ${mats.ridgeCapBundles}`,
    `Drip edge (ft): ${mats.dripEdgeFeet}`,
    estForMats?.roofSquares ? `Roof: ~${estForMats.roofSquares} squares` : "",
  ]
    .filter(Boolean)
    .join("\n");
  output.materials = {
    bomText,
    shingleBundles: mats.shingleBundles,
    underlaymentRolls: mats.underlaymentRolls,
  };

  let stepMaterialsId: string | null = null;
  try {
    const { data: stepRow } = await (supabase as any)
      .from("workflow_step_runs")
      .insert({
        workflow_run_id: workflowRunId,
        step: "materials.run",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    stepMaterialsId = stepRow?.id;
    await (supabase as any)
      .from("workflow_step_runs")
      .update({
        status: "completed",
        payload: output.materials,
        completed_at: new Date().toISOString(),
      })
      .eq("id", stepMaterialsId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Materials step failed";
    errors.push(`materials: ${msg}`);
    if (stepMaterialsId) {
      await (supabase as any)
        .from("workflow_step_runs")
        .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
        .eq("id", stepMaterialsId);
    }
  }

  // Step 3: xactimate.packet (scope + draft line list)
  // Compute payload first so we never lose it if DB insert/update fails
  const estForXact = output.estimate;
  const costRange = estForXact?.costRange ?? { low: 10000, high: 15000 };
  const scope = [
    `--- Scope of Work ---`,
    `Address: ${address}`,
    `Estimated replacement: ${estForXact?.roofSquares ?? "~25"} squares`,
    `Cost range: $${costRange.low.toLocaleString()} - $${costRange.high.toLocaleString()}`,
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");
  const lineItems = [
    "DRAFT LINE ITEMS (upload to Xactimate for full scope):",
    "- Tear-off & disposal",
    "- Replacement shingles",
    "- Underlayment",
    "- Ridge cap",
    "- Drip edge",
    "- Flashing as needed",
  ].join("\n");
  output.xactimatePacket = { scope, lineItems };

  let stepXactId: string | null = null;
  try {
    const { data: stepRow } = await (supabase as any)
      .from("workflow_step_runs")
      .insert({
        workflow_run_id: workflowRunId,
        step: "xactimate.packet",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    stepXactId = stepRow?.id;
    await (supabase as any)
      .from("workflow_step_runs")
      .update({
        status: "completed",
        payload: output.xactimatePacket,
        completed_at: new Date().toISOString(),
      })
      .eq("id", stepXactId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xactimate packet step failed";
    errors.push(`xactimate: ${msg}`);
    if (stepXactId) {
      await (supabase as any)
        .from("workflow_step_runs")
        .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
        .eq("id", stepXactId);
    }
  }

  // Step 4: eagleview.order (when integration exists)
  const eagleviewClientId = process.env.EAGLEVIEW_CLIENT_ID?.trim();
  const eagleviewClientSecret = process.env.EAGLEVIEW_CLIENT_SECRET?.trim();
  if (eagleviewClientId && eagleviewClientSecret) {
    let stepEagleId: string | null = null;
    try {
      const { data: stepRow } = await (supabase as any)
        .from("workflow_step_runs")
        .insert({
          workflow_run_id: workflowRunId,
          step: "eagleview.order",
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      stepEagleId = stepRow?.id;

      // TODO: Implement EagleView Measurement Orders API when partner credentials are provisioned.
      // See https://developer.eagleview.com/user-guides/developer-guides/measurement-orders-api
      const orderId = `ev-placeholder-${stopId.slice(0, 8)}`;

      await (supabase as any)
        .from("workflow_step_runs")
        .update({
          status: "completed",
          payload: { orderId },
          completed_at: new Date().toISOString(),
        })
        .eq("id", stepEagleId);

      (output as Record<string, unknown>).eagleviewOrderId = orderId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "EagleView order step failed";
      errors.push(`eagleview: ${msg}`);
      if (stepEagleId) {
        await (supabase as any)
          .from("workflow_step_runs")
          .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
          .eq("id", stepEagleId);
      }
    }
  }

  const runStatus = errors.length > 0 ? "partial" : "completed";
  await (supabase as any)
    .from("workflow_runs")
    .update({
      status: runStatus,
      payload: output,
      errors: errors,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workflowRunId);

  return { workflowRunId, output, errors };
}
