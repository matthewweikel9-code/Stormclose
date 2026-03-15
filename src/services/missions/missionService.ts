type MissionRecord = {
	id: string;
	userId: string;
	name: string;
	status: "planned" | "in_progress" | "completed" | "cancelled";
	assignedRepId: string | null;
	aiGenerated: boolean;
	createdAt: string;
};

const missionRecords: MissionRecord[] = [];

function seedMissions() {
	if (missionRecords.length > 0) return;
	missionRecords.push({
		id: "mission-1",
		userId: "test-user",
		name: "Seed Mission",
		status: "planned",
		assignedRepId: null,
		aiGenerated: false,
		createdAt: new Date().toISOString(),
	});
}

export const missionsService = {
	async listMissions(
		userId: string,
		filters: {
			status?: MissionRecord["status"];
			assignedRepId?: string;
			aiGenerated?: boolean;
			q?: string;
			limit?: number;
		}
	) {
		seedMissions();
		let rows = missionRecords.filter((row) => row.userId === userId);

		if (filters.status) rows = rows.filter((row) => row.status === filters.status);
		if (filters.assignedRepId) rows = rows.filter((row) => row.assignedRepId === filters.assignedRepId);
		if (filters.aiGenerated !== undefined) rows = rows.filter((row) => row.aiGenerated === filters.aiGenerated);
		if (filters.q) {
			const q = filters.q.trim().toLowerCase();
			rows = rows.filter((row) => row.name.toLowerCase().includes(q));
		}
		if (filters.limit && Number.isFinite(filters.limit)) rows = rows.slice(0, filters.limit);

		return rows;
	},

	async createMission(userId: string, input: Record<string, unknown>) {
		const name = typeof input.name === "string" ? input.name : "Untitled Mission";
		const mission: MissionRecord = {
			id: `mission-${Date.now()}`,
			userId,
			name,
			status: "planned",
			assignedRepId: null,
			aiGenerated: false,
			createdAt: new Date().toISOString(),
		};
		missionRecords.unshift(mission);
		return { mission };
	},
};
