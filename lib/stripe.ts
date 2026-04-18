import "server-only";

import Stripe from "stripe";

const globalForStripe = globalThis as typeof globalThis & {
  stripe?: Stripe;
};

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(secretKey, {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return globalForStripe.stripe;
}

export default getStripe;
