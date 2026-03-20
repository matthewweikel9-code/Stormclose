import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeatureAccess } from "@/lib/subscriptions/access";
import {
  runAppointmentSetWorkflow,
  getExistingWorkflowRun,
  getWorkflowOutputForStop,
  workflowStepOutputToCrmPacket,
  isCrmWorkflowPacketComplete,
  type AppointmentSetPayload,
} from "@/lib/workflows/appointment-set";

/**
 * POST /api/workflows/appointment-set
 * Trigger appointment.set orchestration: estimate, materials, xactimate, then CRM sync.
 * Idempotent: (userId, stopId, 'appointment_set_v1').
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkFeatureAccess(user.id, "lead_generator");
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason ?? "Lead Generator requires a higher subscription tier." },
        { status: 403 }
      );
    }

    let body: { stopId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { stopId } = body;
    if (!stopId) {
      return NextResponse.json({ error: "stopId is required" }, { status: 400 });
    }

    // Fetch mission stop
    const { data: stop, error: stopError } = await (supabase as any)
      .from("mission_stops")
      .select("id, mission_id, user_id, address, city, state, zip, latitude, longitude")
      .eq("id", stopId)
      .eq("user_id", user.id)
      .single();

    if (stopError || !stop) {
      return NextResponse.json({ error: "Mission stop not found" }, { status: 404 });
    }

    // Only skip re-running when we have a full CRM packet (estimate + materials BOM + Xactimate).
    // Previously any workflow row caused alreadyRan + partial/null output, so JobNimbus export
    // never merged materials/Xactimate from DB and skipped re-run.
    const saved = await getWorkflowOutputForStop(supabase, user.id, stopId);
    const crmFromDb = saved ? workflowStepOutputToCrmPacket(saved) : null;
    if (crmFromDb && isCrmWorkflowPacketComplete(crmFromDb)) {
      const existing = await getExistingWorkflowRun(supabase, user.id, stopId);
      return NextResponse.json({
        success: true,
        workflowRunId: existing?.id,
        status: existing?.status ?? "completed",
        alreadyRan: true,
        output: {
          estimate: saved!.estimate
            ? { costRange: saved!.estimate.costRange, roofSquares: saved!.estimate.roofSquares }
            : null,
          materials: saved!.materials ? { bomText: saved!.materials.bomText } : null,
          xactimatePacket: saved!.xactimatePacket
            ? { scope: saved!.xactimatePacket.scope, lineItems: saved!.xactimatePacket.lineItems }
            : null,
        },
        message: "Workflow already ran for this appointment",
      });
    }

    const fullAddress = [stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(", ");
    const correlationId = `appt-${stopId}-${Date.now()}`;

    const payload: AppointmentSetPayload = {
      stopId,
      missionId: stop.mission_id,
      userId: user.id,
      address: fullAddress || stop.address || "Unknown",
      lat: stop.latitude ?? 0,
      lng: stop.longitude ?? 0,
      correlationId,
    };

    const { workflowRunId, output, errors } = await runAppointmentSetWorkflow(payload);

    return NextResponse.json({
      success: errors.length === 0,
      workflowRunId,
      correlationId,
      output: {
        estimate: output.estimate ? { costRange: output.estimate.costRange, roofSquares: output.estimate.roofSquares } : null,
        materials: output.materials ? { bomText: output.materials.bomText } : null,
        xactimatePacket: output.xactimatePacket
          ? { scope: output.xactimatePacket.scope, lineItems: output.xactimatePacket.lineItems }
          : null,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Appointment set workflow error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow failed" },
      { status: 500 }
    );
  }
}
