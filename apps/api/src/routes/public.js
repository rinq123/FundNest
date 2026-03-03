import { randomUUID } from "crypto";
import { Router } from "express";
import { executeQuery, queryMany, queryOne } from "../db/sql.js";
import { createPaymentIntent } from "../payments/provider.js";

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

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,120}$/.test(slug);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loadTenantBySlug(slug) {
  return queryOne(
    `
      SELECT
        t.tenantId,
        t.slug,
        t.name,
        t.archivedAt,
        c.brandColor,
        c.logoUrl,
        c.currency,
        c.donationPresets
      FROM dbo.Tenants t
      LEFT JOIN dbo.TenantConfig c ON c.tenantId = t.tenantId
      WHERE t.slug = @slug
        AND t.archivedAt IS NULL
    `,
    { slug }
  );
}

router.get("/tenants", async (_req, res) => {
  try {
    const rows = await queryMany(
      `
        SELECT
          t.tenantId,
          t.slug,
          t.name,
          c.brandColor
        FROM dbo.Tenants t
        LEFT JOIN dbo.TenantConfig c ON c.tenantId = t.tenantId
        WHERE t.archivedAt IS NULL
        ORDER BY t.createdAt DESC
      `
    );

    return res.status(200).json({
      count: rows.length,
      tenants: rows.map((row) => ({
        tenantId: row.tenantId,
        slug: row.slug,
        name: row.name,
        brandColor: row.brandColor ?? "#0f5ca8"
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: "Tenant list lookup failed", detail: error.message });
  }
});

router.get("/tenants/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").trim().toLowerCase();

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: "Invalid tenant slug" });
    }

    const tenant = await loadTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.status(200).json({
      tenantId: tenant.tenantId,
      slug: tenant.slug,
      name: tenant.name,
      config: {
        brandColor: tenant.brandColor ?? "#0f5ca8",
        logoUrl: tenant.logoUrl,
        currency: tenant.currency ?? "GBP",
        donationPresets: parseDonationPresets(tenant.donationPresets)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Tenant lookup failed", detail: error.message });
  }
});

router.post("/donations", async (req, res) => {
  try {
    const tenantSlug = String(req.body?.tenantSlug ?? "").trim().toLowerCase();
    const donorEmailRaw = req.body?.donorEmail;
    const amountMinor = req.body?.amountMinor;

    if (!isValidSlug(tenantSlug)) {
      return res.status(400).json({ error: "tenantSlug is required and must be lowercase slug format" });
    }

    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({ error: "amountMinor must be a positive integer in minor units" });
    }

    let donorEmail = null;
    if (donorEmailRaw !== undefined && donorEmailRaw !== null && donorEmailRaw !== "") {
      donorEmail = String(donorEmailRaw).trim().toLowerCase();
      if (!isValidEmail(donorEmail)) {
        return res.status(400).json({ error: "donorEmail must be a valid email address" });
      }
    }

    const tenant = await loadTenantBySlug(tenantSlug);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const currency = String(req.body?.currency ?? tenant.currency ?? "GBP")
      .trim()
      .toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({ error: "currency must be a valid 3-letter code" });
    }

    const donationId = randomUUID();

    const paymentIntent = await createPaymentIntent({
      amountMinor,
      currency,
      donorEmail,
      metadata: {
        donationId,
        tenantId: tenant.tenantId,
        tenantSlug: tenant.slug
      }
    });

    await executeQuery(
      `
        INSERT INTO dbo.Donations (
          donationId,
          tenantId,
          amountMinor,
          currency,
          donorEmail,
          status,
          stripePaymentIntentId,
          stripeEventId
        )
        VALUES (
          @donationId,
          @tenantId,
          @amountMinor,
          @currency,
          @donorEmail,
          @status,
          @stripePaymentIntentId,
          @stripeEventId
        )
      `,
      {
        donationId,
        tenantId: tenant.tenantId,
        amountMinor,
        currency,
        donorEmail,
        status: "Pending",
        stripePaymentIntentId: paymentIntent.id,
        stripeEventId: null
      }
    );

    return res.status(201).json({
      donationId,
      tenantId: tenant.tenantId,
      tenantSlug: tenant.slug,
      amountMinor,
      currency,
      status: "Pending",
      stripePaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      paymentProvider: paymentIntent.provider
    });
  } catch (error) {
    if (error?.message === "STRIPE_SECRET_KEY is not configured") {
      return res.status(500).json({ error: "Stripe is not configured on server" });
    }

    if (error?.type === "StripeAuthenticationError") {
      return res.status(502).json({ error: "Stripe authentication failed. Check STRIPE_SECRET_KEY" });
    }

    return res.status(500).json({ error: "Donation creation failed", detail: error.message });
  }
});

export default router;
