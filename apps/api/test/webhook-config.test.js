import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("Stripe webhook configuration", () => {
  it("returns 500 when webhook secret is not configured", async () => {
    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("Stripe-Signature", "dummy")
      .set("Content-Type", "application/json")
      .send("{}");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("STRIPE_WEBHOOK_SECRET is not configured");
  });
});
