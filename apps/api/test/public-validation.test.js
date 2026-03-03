import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("Public route validation", () => {
  it("rejects invalid slug format for GET /api/public/tenants/:slug", async () => {
    const response = await request(app).get("/api/public/tenants/Bad_Slug");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid tenant slug");
  });

  it("rejects missing/invalid tenantSlug for POST /api/public/donations", async () => {
    const response = await request(app).post("/api/public/donations").send({ amountMinor: 1200 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "tenantSlug is required and must be lowercase slug format"
    );
  });

  it("rejects invalid amountMinor for POST /api/public/donations", async () => {
    const response = await request(app)
      .post("/api/public/donations")
      .send({ tenantSlug: "tenant-one", amountMinor: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("amountMinor must be a positive integer in minor units");
  });
});
