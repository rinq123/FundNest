import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("Admin routes auth guard", () => {
  it("rejects GET /api/admin/donations without token", async () => {
    const response = await request(app).get("/api/admin/donations");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing or invalid Authorization header");
  });

  it("rejects PATCH /api/admin/config without token", async () => {
    const response = await request(app)
      .patch("/api/admin/config")
      .send({ brandColor: "#123456" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing or invalid Authorization header");
  });

  it("rejects GET /api/admin/me with invalid token", async () =>{
    const response = await request (app)
    .get("/api/admin/me")
    .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid or expired token");
    });

  it("rejects POST /api/admin/change-password without token", async () => {
    const response = await request(app)
      .post("/api/admin/change-password")
      .send({ currentPassword: "DemoAdmin123!", newPassword: "NewStrongPassword123!" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing or invalid Authorization header");
  });
});
