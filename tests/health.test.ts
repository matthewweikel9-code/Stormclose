import { describe, expect, it } from "vitest";
import { GET } from "../src/app/api/health/route";

describe("/api/health", () => {
  it("returns JSON payload with status and timestamp", async () => {
    const response = await GET();

    expect(response.status).toBe(200);

    const data = (await response.json()) as {
      status: "healthy" | "degraded";
      timestamp: string;
      environment?: string;
      missingEnvVars?: string[];
    };

    expect(["healthy", "degraded"]).toContain(data.status);
    expect(typeof data.timestamp).toBe("string");
    expect(() => new Date(data.timestamp)).not.toThrow();
  });
});
