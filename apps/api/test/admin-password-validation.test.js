import request from "supertest";
import { describe, expect, it } from "vitest";
import { signUserToken } from "../src/auth/jwt.js";
import app from "../src/app.js";

describe("Tenant admin password change validation", () => {
  const token = signUserToken({
    userId: "22222222-2222-2222-2222-222222222222",
    tenantId: "11111111-1111-1111-1111-111111111111",
    email: "admin@tenant-one.local",
    role: "tenant_admin",
    tenantSlug: "tenant-one"
  });

  it("requires currentPassword and newPassword", async () => {
    const response = await request(app)
      .post("/api/admin/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("currentPassword and newPassword are required");
  });

  it("enforces minimum newPassword length", async () => {
    const response = await request(app)
      .post("/api/admin/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!", newPassword: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("newPassword must be between 8 and 128 characters");
  });

  it("rejects unchanged password", async () => {
    const response = await request(app)
      .post("/api/admin/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "CurrentPass123!", newPassword: "CurrentPass123!" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("newPassword must be different from currentPassword");
  });
});
