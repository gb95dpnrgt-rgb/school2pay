import { GET } from "@/app/health/route";
import { describe, it, expect } from "vitest";

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = GET();
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
