import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { getStripeClient } from "./stripe.js";

export function createDemoPaymentIntent() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 24);
  const id = `pi_demo_${suffix}`;

  return {
    id,
    clientSecret: `${id}_secret_demo`,
    provider: "demo"
  };
}

export async function createPaymentIntent({ amountMinor, currency, donorEmail, metadata }) {
  if (env.paymentsMode === "demo") {
    return createDemoPaymentIntent();
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountMinor,
    currency: currency.toLowerCase(),
    receipt_email: donorEmail ?? undefined,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never"
    },
    metadata
  });

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    provider: "stripe"
  };
}
