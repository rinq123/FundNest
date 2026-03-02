import { randomUUID } from "crypto";
import { Router } from "express";
import { verifyToken } from "../auth/jwt.js";
import { env } from "../config/env.js";
import { executeQuery, queryMany, queryOne } from "../db/sql.js";

const router = Router();

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,120}$/.test(slug);
}

function isValidName(name) {
  return name.length >= 2 && name.length <= 200;
}

function isValidGuid(value) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

function readBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function requirePlatformAccess(req, res, next) {
  const providedSecret = String(req.header("x-platform-secret") ?? "");
  const bearerToken = readBearerToken(req.header("authorization"));

  // Legacy secret-based access (for local testing/tools).
  if (providedSecret) {
    if (!env.platformAdminSecret) {
      return res.status(500).json({ error: "PLATFORM_ADMIN_SECRET is not configured" });
    }
    if (providedSecret === env.platformAdminSecret) {
      req.platformAccess = "secret";
      return next();
    }
    if (!bearerToken) {
      return res.status(403).json({ error: "Invalid platform admin secret" });
    }
  }

  if (!bearerToken) {
    return res.status(401).json({ error: "Missing platform admin credentials" });
  }

  try {
    const claims = verifyToken(bearerToken);
    if (claims?.role !== "platform_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.auth = claims;
    req.platformAccess = "jwt";
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function toTenantDto(row) {
  return {
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
    isArchived: Boolean(row.archivedAt),
    adminUserCount: Number(row.adminUserCount ?? 0),
    donationCount: Number(row.donationCount ?? 0),
    config: {
      brandColor: row.brandColor ?? "#0f5ca8",
      logoUrl: row.logoUrl ?? null,
      currency: row.currency ?? "GBP",
      donationPresets: null
    }
  };
}

async function loadTenantById(tenantId) {
  return queryOne(
    `
      SELECT
        t.tenantId,
        t.name,
        t.slug,
        t.createdAt,
        t.archivedAt,
        c.brandColor,
        c.logoUrl,
        c.currency,
        (SELECT COUNT(*) FROM dbo.Users u WHERE u.tenantId = t.tenantId) AS adminUserCount,
        (SELECT COUNT(*) FROM dbo.Donations d WHERE d.tenantId = t.tenantId) AS donationCount
      FROM dbo.Tenants t
      LEFT JOIN dbo.TenantConfig c ON c.tenantId = t.tenantId
      WHERE t.tenantId = @tenantId
    `,
    { tenantId }
  );
}

router.use(requirePlatformAccess);

router.get("/tenants", async (_req, res) => {
  try {
    const rows = await queryMany(
      `
        SELECT
          t.tenantId,
          t.name,
          t.slug,
          t.createdAt,
          t.archivedAt,
          c.brandColor,
          c.logoUrl,
          c.currency,
          (SELECT COUNT(*) FROM dbo.Users u WHERE u.tenantId = t.tenantId) AS adminUserCount,
          (SELECT COUNT(*) FROM dbo.Donations d WHERE d.tenantId = t.tenantId) AS donationCount
        FROM dbo.Tenants t
        LEFT JOIN dbo.TenantConfig c ON c.tenantId = t.tenantId
        ORDER BY t.createdAt DESC
      `
    );

    return res.status(200).json({
      count: rows.length,
      tenants: rows.map(toTenantDto)
    });
  } catch (error) {
    return res.status(500).json({ error: "Tenant list failed", detail: error.message });
  }
});

router.post("/tenants", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const slug = String(req.body?.slug ?? "").trim().toLowerCase();

    if (!isValidName(name)) {
      return res.status(400).json({ error: "name is required and must be 2-200 characters" });
    }

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: "slug is required and must be lowercase slug format" });
    }

    const existingTenant = await queryOne(
      `
        SELECT tenantId
        FROM dbo.Tenants
        WHERE slug = @slug
      `,
      { slug }
    );

    if (existingTenant) {
      return res.status(409).json({ error: "slug already exists" });
    }

    const tenantId = randomUUID();

    await executeQuery(
      `
        INSERT INTO dbo.Tenants (tenantId, name, slug)
        VALUES (@tenantId, @name, @slug)
      `,
      { tenantId, name, slug }
    );

    await executeQuery(
      `
        INSERT INTO dbo.TenantConfig (tenantId, brandColor, logoUrl, currency, donationPresets)
        VALUES (@tenantId, @brandColor, @logoUrl, @currency, @donationPresets)
      `,
      {
        tenantId,
        brandColor: "#0f5ca8",
        logoUrl: null,
        currency: "GBP",
        donationPresets: null
      }
    );

    const tenant = await loadTenantById(tenantId);
    return res.status(201).json(toTenantDto(tenant));
  } catch (error) {
    return res.status(500).json({ error: "Tenant creation failed", detail: error.message });
  }
});

router.patch("/tenants/:tenantId/archive", async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId ?? "").trim();
    const archived = req.body?.archived;

    if (!isValidGuid(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    if (typeof archived !== "boolean") {
      return res.status(400).json({ error: "archived must be a boolean" });
    }

    const result = await executeQuery(
      `
        UPDATE dbo.Tenants
        SET archivedAt = CASE
          WHEN @archived = 1 THEN COALESCE(archivedAt, SYSUTCDATETIME())
          ELSE NULL
        END
        WHERE tenantId = @tenantId
      `,
      { tenantId, archived: archived ? 1 : 0 }
    );

    const updated = Number(result.rowsAffected?.[0] ?? 0) > 0;
    if (!updated) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const tenant = await loadTenantById(tenantId);
    return res.status(200).json(toTenantDto(tenant));
  } catch (error) {
    return res.status(500).json({ error: "Tenant archive update failed", detail: error.message });
  }
});

router.delete("/tenants/:tenantId", async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId ?? "").trim();

    if (!isValidGuid(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const result = await executeQuery(
      `
        DELETE FROM dbo.Tenants
        WHERE tenantId = @tenantId
      `,
      { tenantId }
    );

    const removed = Number(result.rowsAffected?.[0] ?? 0) > 0;
    if (!removed) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Tenant deletion failed", detail: error.message });
  }
});

export default router;
