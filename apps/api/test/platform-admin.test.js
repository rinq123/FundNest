import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";

describe("Platform admin route guard", () => {
  it("rejects tenant creation without secret header", async () => {
    const response = await request(app).post("/api/platform/tenants").send({
      name: "Helping Hands",
      slug: "helping-hands"
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing x-platform-secret header");
  });

  it("rejects tenant creation with invalid secret", async () => {
    const response = await request(app)
      .post("/api/platform/tenants")
      .set("x-platform-secret", "wrong-secret")
      .send({
        name: "Helping Hands",
        slug: "helping-hands"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Invalid platform admin secret");
  });

  it("rejects invalid payload before touching DB", async () => {
    const response = await request(app)
      .post("/api/platform/tenants")
      .set("x-platform-secret", env.platformAdminSecret)
      .send({
        name: "A",
        slug: "Invalid_Slug"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("name is required and must be 2-200 characters");
  });
});
