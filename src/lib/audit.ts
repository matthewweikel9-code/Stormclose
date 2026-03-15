import { logger } from "@/lib/logger";

export type AuditEvent = {
	category: "export" | "mission" | "ai" | "integration";
	action: string;
	userId: string | null;
	entityId?: string;
	status?: "success" | "failed" | "partial";
	metadata?: Record<string, unknown>;
};

export function logAuditEvent(event: AuditEvent) {
	logger.info("audit.event", {
		category: event.category,
		action: event.action,
		userId: event.userId,
		entityId: event.entityId ?? null,
		status: event.status ?? "success",
		metadata: event.metadata ?? {},
	});
}
