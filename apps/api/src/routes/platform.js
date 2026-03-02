import { randomUUID } from "crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { executeQuery, queryOne } from "../db/sql.js";

const router = Router();

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,120}$/.test(slug);
}

function isValidName(name) {
  return name.length >= 2 && name.length <= 200;
}

function requirePlatformSecret(req, res, next) {
  if (!env.platformAdminSecret) {
    return res.status(500).json({ error: "PLATFORM_ADMIN_SECRET is not configured" });
  }

  const providedSecret = String(req.header("x-platform-secret") ?? "");
  if (!providedSecret) {
    return res.status(401).json({ error: "Missing x-platform-secret header" });
  }

  if (providedSecret !== env.platformAdminSecret) {
    return res.status(403).json({ error: "Invalid platform admin secret" });
  }

  return next();
}

router.post("/tenants", requirePlatformSecret, async (req, res) => {
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

    return res.status(201).json({
      tenantId,
      name,
      slug,
      config: {
        brandColor: "#0f5ca8",
        logoUrl: null,
        currency: "GBP",
        donationPresets: null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Tenant creation failed", detail: error.message });
  }
});

export default router;
