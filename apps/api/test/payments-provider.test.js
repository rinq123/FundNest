import { describe, expect, it } from "vitest";
import { createDemoPaymentIntent } from "../src/payments/provider.js";

describe("Payments provider", () => {
  it("creates demo payment intent shape", () => {
    const paymentIntent = createDemoPaymentIntent();

    expect(paymentIntent.provider).toBe("demo");
    expect(paymentIntent.id.startsWith("pi_demo_")).toBe(true);
    expect(paymentIntent.clientSecret).toContain("_secret_demo");
  });
});
