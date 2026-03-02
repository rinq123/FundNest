import bcrypt from "bcryptjs";
import { Router } from "express";
import { signUserToken } from "../auth/jwt.js";
import { queryOne } from "../db/sql.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const tenantSlug = String(req.body?.tenantSlug ?? "").trim().toLowerCase();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!tenantSlug || !email || !password) {
      return res.status(400).json({ error: "tenantSlug, email, and password are required" });
    }

    const user = await queryOne(
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
        WHERE t.slug = @tenantSlug AND u.email = @email
      `,
      { tenantSlug, email }
    );

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
        tenantSlug: user.tenantSlug,
        tenantName: user.tenantName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed", detail: error.message });
  }
});

export default router;
