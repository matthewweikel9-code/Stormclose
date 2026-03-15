type HeartbeatInput = {
	missionId: string;
	lat: number;
	lng: number;
	accuracy: number | null;
	heading: number | null;
	speed: number | null;
};

export const presenceService = {
	async heartbeat(userId: string, input: HeartbeatInput) {
		return {
			presence: {
				userId,
				missionId: input.missionId,
				lat: input.lat,
				lng: input.lng,
				accuracy: input.accuracy,
				heading: input.heading,
				speed: input.speed,
				timestamp: new Date().toISOString(),
			},
			nextBest: null,
			nextIntervalSeconds: 30,
		};
	},
};
