import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("Auth login validation", () => {
  it("requires email and password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      loginMode: "platform"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("email and password are required");
  });

  it("requires tenantSlug for tenant login mode", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@democharity.local",
      password: "DemoAdmin123!"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("tenantSlug is required for tenant login");
  });

  it("rejects unknown login mode", async () => {
    const response = await request(app).post("/api/auth/login").send({
      loginMode: "super-admin",
      email: "platform@fundnest.local",
      password: "DemoPlatform123!"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("loginMode must be either tenant or platform");
  });
});
