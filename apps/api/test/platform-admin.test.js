import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import { signUserToken } from "../src/auth/jwt.js";
import { env } from "../src/config/env.js";

describe("Platform admin route guard", () => {
  it("rejects list without secret header", async () => {
    const response = await request(app).get("/api/platform/tenants");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing platform admin credentials");
  });

  it("rejects tenant creation without secret header", async () => {
    const response = await request(app).post("/api/platform/tenants").send({
      name: "Helping Hands",
      slug: "helping-hands"
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing platform admin credentials");
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

  it("rejects archive update with invalid tenantId format", async () => {
    const response = await request(app)
      .patch("/api/platform/tenants/not-a-guid/archive")
      .set("x-platform-secret", env.platformAdminSecret)
      .send({ archived: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid tenantId format");
  });

  it("rejects archive update with non-boolean archived value", async () => {
    const tenantId = "11111111-1111-1111-1111-111111111111";
    const response = await request(app)
      .patch(`/api/platform/tenants/${tenantId}/archive`)
      .set("x-platform-secret", env.platformAdminSecret)
      .send({ archived: "yes" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("archived must be a boolean");
  });

  it("rejects delete with invalid tenantId format", async () => {
    const response = await request(app)
      .delete("/api/platform/tenants/not-a-guid")
      .set("x-platform-secret", env.platformAdminSecret);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid tenantId format");
  });

  it("rejects tenant detail lookup with invalid tenantId format", async () => {
    const response = await request(app)
      .get("/api/platform/tenants/not-a-guid")
      .set("x-platform-secret", env.platformAdminSecret);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid tenantId format");
  });

  it("rejects tenant donations lookup with invalid tenantId format", async () => {
    const response = await request(app)
      .get("/api/platform/tenants/not-a-guid/donations")
      .set("x-platform-secret", env.platformAdminSecret);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid tenantId format");
  });

  it("accepts platform admin jwt and reaches validation layer", async () => {
    const token = signUserToken({
      userId: "99999999-9999-9999-9999-999999999999",
      tenantId: null,
      email: "platform@fundnest.local",
      role: "platform_admin",
      tenantSlug: null
    });

    const response = await request(app)
      .post("/api/platform/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "A",
        slug: "invalid_slug"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("name is required and must be 2-200 characters");
  });

  it("rejects tenant admin jwt on platform routes", async () => {
    const token = signUserToken({
      userId: "88888888-8888-8888-8888-888888888888",
      tenantId: "11111111-1111-1111-1111-111111111111",
      email: "admin@tenant-one.local",
      role: "tenant_admin",
      tenantSlug: "tenant-one"
    });

    const response = await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });
});
