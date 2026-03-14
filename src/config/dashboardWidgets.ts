import type { UserRole } from "@/lib/auth/roles";

export type DashboardWidgetId =
	| "aiDailyBrief"
	| "housesToHitToday"
	| "topStormZones"
	| "aiDeploymentPlan"
	| "liveTeamSnapshot"
	| "unassignedHotClusters"
	| "recentQualifiedOpps"
	| "exportQueueSummary"
	| "dataHealth";

export interface DashboardWidgetConfig {
	id: DashboardWidgetId;
	title: string;
	roles: UserRole[];
}

export const DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
	{ id: "aiDailyBrief", title: "AI Daily Brief", roles: ["owner", "manager", "rep", "office_admin"] },
	{ id: "housesToHitToday", title: "Houses To Hit Today", roles: ["owner", "manager", "rep", "office_admin"] },
	{ id: "topStormZones", title: "Top Storm Zones", roles: ["owner", "manager"] },
	{ id: "aiDeploymentPlan", title: "AI Deployment Plan", roles: ["owner", "manager"] },
	{ id: "liveTeamSnapshot", title: "Live Team Snapshot", roles: ["owner", "manager", "office_admin"] },
	{ id: "unassignedHotClusters", title: "Unassigned Hot Clusters", roles: ["owner", "manager"] },
	{ id: "recentQualifiedOpps", title: "Recent Qualified Opportunities", roles: ["owner", "manager", "rep", "office_admin"] },
	{ id: "exportQueueSummary", title: "Export Queue Summary", roles: ["owner", "manager", "office_admin"] },
	{ id: "dataHealth", title: "System Freshness / Data Health", roles: ["owner", "manager"] },
];

export function getVisibleDashboardWidgets(role: UserRole): DashboardWidgetId[] {
	return DASHBOARD_WIDGETS.filter((widget) => widget.roles.includes(role)).map((widget) => widget.id);
}
