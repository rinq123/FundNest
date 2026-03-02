import bcrypt from "bcryptjs";
import { Router } from "express";
import { signUserToken } from "../auth/jwt.js";
import { queryOne } from "../db/sql.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const loginMode = String(req.body?.loginMode ?? "tenant")
      .trim()
      .toLowerCase();
    const tenantSlug = String(req.body?.tenantSlug ?? "").trim().toLowerCase();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (loginMode !== "tenant" && loginMode !== "platform") {
      return res.status(400).json({ error: "loginMode must be either tenant or platform" });
    }

    let user = null;

    if (loginMode === "platform") {
      user = await queryOne(
        `
          SELECT TOP 1
            u.userId,
            u.tenantId,
            u.email,
            u.passwordHash,
            u.role,
            CAST(NULL AS NVARCHAR(120)) AS tenantSlug,
            CAST(NULL AS NVARCHAR(200)) AS tenantName
          FROM dbo.Users u
          WHERE u.email = @email
            AND u.role = 'platform_admin'
            AND u.tenantId IS NULL
        `,
        { email }
      );
    } else {
      if (!tenantSlug) {
        return res.status(400).json({ error: "tenantSlug is required for tenant login" });
      }

      user = await queryOne(
        `
          SELECT TOP 1
            u.userId,
            u.tenantId,
            u.email,
            u.passwordHash,
            u.role,
            t.slug AS tenantSlug,
            t.name AS tenantName
          FROM dbo.Users u
          INNER JOIN dbo.Tenants t ON t.tenantId = u.tenantId
          WHERE t.slug = @tenantSlug
            AND u.email = @email
            AND u.role = 'tenant_admin'
            AND t.archivedAt IS NULL
        `,
        { tenantSlug, email }
      );
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signUserToken(user);

    return res.status(200).json({
      accessToken,
      tokenType: "Bearer",
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        tenantSlug: user.tenantSlug ?? null,
        tenantName: user.tenantName ?? null,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed", detail: error.message });
  }
});

export default router;
