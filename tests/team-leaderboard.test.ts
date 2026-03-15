import { describe, expect, it } from "vitest";
import { computeLeaderboard } from "@/services/team/exceptionService";
import type { LeaderboardInput } from "@/services/team/exceptionService";

function entry(overrides: Partial<LeaderboardInput> = {}): LeaderboardInput {
	return {
		userId: "rep-1",
		name: "Alice",
		avatarUrl: null,
		branchName: null,
		doorsKnocked: 0,
		appointmentsSet: 0,
		noAnswerCount: 0,
		activeMinutes: 0,
		missionsCompleted: 0,
		estimatedPipeline: 0,
		...overrides,
	};
}

describe("Leaderboard KPIs", () => {
	it("ranks reps by doors knocked descending", () => {
		const result = computeLeaderboard([
			entry({ userId: "rep-a", name: "Alice", doorsKnocked: 20 }),
			entry({ userId: "rep-b", name: "Bob", doorsKnocked: 40 }),
			entry({ userId: "rep-c", name: "Charlie", doorsKnocked: 30 }),
		]);

		expect(result[0].name).toBe("Bob");
		expect(result[0].rank).toBe(1);
		expect(result[1].name).toBe("Charlie");
		expect(result[1].rank).toBe(2);
		expect(result[2].name).toBe("Alice");
		expect(result[2].rank).toBe(3);
	});

	it("computes conversion rate correctly", () => {
		const result = computeLeaderboard([
			entry({
				userId: "rep-a",
				name: "Alice",
				doorsKnocked: 50,
				appointmentsSet: 10,
			}),
		]);

		expect(result[0].metrics.conversionRate).toBe(0.2);
	});

	it("handles zero doors (avoids division by zero)", () => {
		const result = computeLeaderboard([
			entry({ userId: "rep-a", name: "Alice", doorsKnocked: 0, appointmentsSet: 0 }),
		]);

		expect(result[0].metrics.conversionRate).toBe(0);
		expect(result[0].metrics.doorsPerHour).toBe(0);
	});

	it("computes doors per hour from active minutes", () => {
		const result = computeLeaderboard([
			entry({
				userId: "rep-a",
				name: "Alice",
				doorsKnocked: 30,
				activeMinutes: 120, // 2 hours
			}),
		]);

		expect(result[0].metrics.doorsPerHour).toBe(15.0);
	});

	it("returns all fields in the result", () => {
		const result = computeLeaderboard([
			entry({
				userId: "rep-a",
				name: "Alice",
				branchName: "OKC Branch",
				doorsKnocked: 25,
				appointmentsSet: 5,
				noAnswerCount: 8,
				activeMinutes: 180,
				missionsCompleted: 3,
				estimatedPipeline: 75000,
			}),
		]);

		const r = result[0];
		expect(r.rank).toBe(1);
		expect(r.userId).toBe("rep-a");
		expect(r.name).toBe("Alice");
		expect(r.branchName).toBe("OKC Branch");
		expect(r.metrics.doorsKnocked).toBe(25);
		expect(r.metrics.appointmentsSet).toBe(5);
		expect(r.metrics.noAnswerCount).toBe(8);
		expect(r.metrics.activeMinutes).toBe(180);
		expect(r.metrics.missionsCompleted).toBe(3);
		expect(r.metrics.estimatedPipeline).toBe(75000);
		expect(r.rankDelta).toBeNull();
	});

	it("returns empty array for empty input", () => {
		const result = computeLeaderboard([]);
		expect(result).toEqual([]);
	});

	it("handles large number of reps", () => {
		const entries = Array.from({ length: 100 }, (_, i) =>
			entry({ userId: `rep-${i}`, name: `Rep ${i}`, doorsKnocked: i }),
		);
		const result = computeLeaderboard(entries);
		expect(result).toHaveLength(100);
		expect(result[0].metrics.doorsKnocked).toBe(99);
		expect(result[99].metrics.doorsKnocked).toBe(0);
	});
});
