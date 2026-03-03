import { describe, expect, it } from "vitest";
import { signUserToken, verifyToken } from "../src/auth/jwt.js";

describe("JWT helpers", () => {
  it("signs and verifies a token with tenant claims", () => {
    const token = signUserToken({
      userId: "22222222-2222-2222-2222-222222222222",
      tenantId: "11111111-1111-1111-1111-111111111111",
      role: "tenant_admin",
      email: "admin@tenant-one.local",
      tenantSlug: "tenant-one"
    });

    const payload = verifyToken(token);

    expect(payload.tenantId).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.role).toBe("tenant_admin");
    expect(payload.tenantSlug).toBe("tenant-one");
  });
});
