import { Router } from "express";
import { executeQuery, queryMany, queryOne } from "../db/sql.js";
import { requireAuth, requireRole, requireTenantScope } from "../middleware/auth.js";

const router = Router();

function parseDonationPresets(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateBrandColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function validateCurrency(value) {
  return /^[A-Z]{3}$/.test(value);
}

function validateDonationPresets(value) {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((amount) => Number.isInteger(amount) && amount > 0);
}

router.get("/me", requireAuth, requireRole("tenant_admin"), requireTenantScope, async (req, res) => {
  try {
    const row = await queryOne(
      `
        SELECT COUNT(*) AS donationCount
        FROM dbo.Donations
        WHERE tenantId = @tenantId
      `,
      { tenantId: req.tenantId }
    );

    return res.status(200).json({
      userId: req.auth.sub,
      tenantId: req.tenantId,
      tenantSlug: req.auth.tenantSlug,
      role: req.auth.role,
      email: req.auth.email,
      donationCount: Number(row?.donationCount ?? 0)
    });
  } catch (error) {
    return res.status(500).json({ error: "Admin context lookup failed", detail: error.message });
  }
});

router.get(
  "/donations",
  requireAuth,
  requireRole("tenant_admin"),
  requireTenantScope,
  async (req, res) => {
    try {
      const rows = await queryMany(
        `
          SELECT
            donationId,
            tenantId,
            amountMinor,
            currency,
            donorEmail,
            status,
            stripePaymentIntentId,
            createdAt
          FROM dbo.Donations
          WHERE tenantId = @tenantId
          ORDER BY createdAt DESC
        `,
        { tenantId: req.tenantId }
      );

      return res.status(200).json({
        tenantId: req.tenantId,
        count: rows.length,
        donations: rows
      });
    } catch (error) {
      return res.status(500).json({ error: "Donation lookup failed", detail: error.message });
    }
  }
);

router.patch("/config", requireAuth, requireRole("tenant_admin"), requireTenantScope, async (req, res) => {
  try {
    const config = await queryOne(
      `
        SELECT tenantId, brandColor, logoUrl, currency, donationPresets
        FROM dbo.TenantConfig
        WHERE tenantId = @tenantId
      `,
      { tenantId: req.tenantId }
    );

    if (!config) {
      return res.status(404).json({ error: "Tenant config not found" });
    }

    const payload = req.body ?? {};
    const hasBrandColor = Object.prototype.hasOwnProperty.call(payload, "brandColor");
    const hasLogoUrl = Object.prototype.hasOwnProperty.call(payload, "logoUrl");
    const hasCurrency = Object.prototype.hasOwnProperty.call(payload, "currency");
    const hasDonationPresets = Object.prototype.hasOwnProperty.call(payload, "donationPresets");

    if (!hasBrandColor && !hasLogoUrl && !hasCurrency && !hasDonationPresets) {
      return res.status(400).json({
        error: "At least one field is required: brandColor, logoUrl, currency, donationPresets"
      });
    }

    let nextBrandColor = config.brandColor;
    let nextLogoUrl = config.logoUrl;
    let nextCurrency = config.currency;
    let nextDonationPresets = config.donationPresets;

    if (hasBrandColor) {
      const value = String(payload.brandColor ?? "").trim();
      if (!validateBrandColor(value)) {
        return res
          .status(400)
          .json({ error: "brandColor must be a hex color like #0f5ca8" });
      }
      nextBrandColor = value;
    }

    if (hasLogoUrl) {
      if (payload.logoUrl === null || payload.logoUrl === "") {
        nextLogoUrl = null;
      } else {
        const value = String(payload.logoUrl).trim();
        if (value.length > 500) {
          return res.status(400).json({ error: "logoUrl must be 500 characters or fewer" });
        }
        nextLogoUrl = value;
      }
    }

    if (hasCurrency) {
      const value = String(payload.currency ?? "")
        .trim()
        .toUpperCase();
      if (!validateCurrency(value)) {
        return res.status(400).json({ error: "currency must be a 3-letter code like GBP" });
      }
      nextCurrency = value;
    }

    if (hasDonationPresets) {
      if (payload.donationPresets === null) {
        nextDonationPresets = null;
      } else if (validateDonationPresets(payload.donationPresets)) {
        nextDonationPresets = JSON.stringify(payload.donationPresets);
      } else {
        return res.status(400).json({
          error: "donationPresets must be null or an array of positive integers in minor units"
        });
      }
    }

    await executeQuery(
      `
        UPDATE dbo.TenantConfig
        SET
          brandColor = @brandColor,
          logoUrl = @logoUrl,
          currency = @currency,
          donationPresets = @donationPresets
        WHERE tenantId = @tenantId
      `,
      {
        tenantId: req.tenantId,
        brandColor: nextBrandColor,
        logoUrl: nextLogoUrl,
        currency: nextCurrency,
        donationPresets: nextDonationPresets
      }
    );

    const updated = await queryOne(
      `
        SELECT tenantId, brandColor, logoUrl, currency, donationPresets
        FROM dbo.TenantConfig
        WHERE tenantId = @tenantId
      `,
      { tenantId: req.tenantId }
    );

    return res.status(200).json({
      tenantId: updated.tenantId,
      brandColor: updated.brandColor,
      logoUrl: updated.logoUrl,
      currency: updated.currency,
      donationPresets: parseDonationPresets(updated.donationPresets)
    });
  } catch (error) {
    return res.status(500).json({ error: "Tenant config update failed", detail: error.message });
  }
});

export default router;
