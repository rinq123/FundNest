import { Router } from "express";
import { env } from "../config/env.js";
import { executeQuery, queryOne } from "../db/sql.js";
import { getStripeClient } from "../payments/stripe.js";

const router = Router();

function mapEventToDonationStatus(eventType) {
  if (eventType === "payment_intent.succeeded") {
    return "Paid";
  }

  if (eventType === "payment_intent.payment_failed" || eventType === "payment_intent.canceled") {
    return "Failed";
  }

  return null;
}

function isDuplicateEventError(error) {
  return error?.number === 2601 || error?.number === 2627;
}

router.post("/stripe", async (req, res) => {
  if (!env.stripeWebhookSecret) {
    return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET is not configured" });
  }

  const signature = req.header("stripe-signature");
  if (!signature) {
    return res.status(400).json({ error: "Missing Stripe-Signature header" });
  }

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch {
    return res.status(400).json({ error: "Invalid Stripe webhook signature" });
  }

  const nextStatus = mapEventToDonationStatus(event.type);
  if (!nextStatus) {
    return res.status(200).json({ received: true, ignored: true, reason: "unsupported_event_type" });
  }

  const stripePaymentIntentId = event?.data?.object?.id;
  if (!stripePaymentIntentId) {
    return res.status(200).json({ received: true, ignored: true, reason: "missing_payment_intent_id" });
  }

  try {
    const donation = await queryOne(
      `
        SELECT donationId, status, stripeEventId
        FROM dbo.Donations
        WHERE stripePaymentIntentId = @stripePaymentIntentId
      `,
      { stripePaymentIntentId }
    );

    if (!donation) {
      return res.status(200).json({ received: true, ignored: true, reason: "donation_not_found" });
    }

    if (donation.stripeEventId === event.id) {
      return res
        .status(200)
        .json({ received: true, ignored: true, reason: "event_already_processed" });
    }

    if (donation.status !== "Pending") {
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: "donation_already_finalized",
        status: donation.status
      });
    }

    const result = await executeQuery(
      `
        UPDATE dbo.Donations
        SET status = @status,
            stripeEventId = @stripeEventId
        WHERE donationId = @donationId
          AND status = 'Pending'
      `,
      {
        donationId: donation.donationId,
        status: nextStatus,
        stripeEventId: event.id
      }
    );

    const updated = Number(result.rowsAffected?.[0] ?? 0) > 0;

    return res.status(200).json({
      received: true,
      updated,
      donationId: donation.donationId,
      status: nextStatus
    });
  } catch (error) {
    if (isDuplicateEventError(error)) {
      return res.status(200).json({ received: true, ignored: true, reason: "duplicate_event" });
    }

    return res.status(500).json({ error: "Webhook processing failed", detail: error.message });
  }
});

export default router;
