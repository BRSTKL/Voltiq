import { NextResponse } from "next/server";
import { Plan } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

type CheckoutPlan = "PRO" | "ENTERPRISE";

type CheckoutBody = {
  plan?: unknown;
};

const ACTIVE_PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

function getPlanPriceId(plan: CheckoutPlan) {
  if (plan === "PRO") {
    return process.env.STRIPE_PRICE_PRO;
  }

  return process.env.STRIPE_PRICE_ENTERPRISE;
}

function getBaseUrl(request: Request) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

function hasActivePaidSubscription(user: {
  plan: Plan;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
}) {
  if (user.plan === Plan.FREE) {
    return false;
  }

  if (user.subscriptionStatus) {
    return ACTIVE_PAID_STATUSES.has(user.subscriptionStatus);
  }

  return Boolean(user.stripeSubscriptionId);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`checkout:${session.user.id}`, {
    windowMs: 60_000,
    maxRequests: 5,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: CheckoutBody;

  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestedPlan = body.plan;

  if (requestedPlan !== "PRO" && requestedPlan !== "ENTERPRISE") {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const priceId = getPlanPriceId(requestedPlan);

  if (!priceId) {
    return NextResponse.json(
      { error: "Missing Stripe price configuration." },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "User email is required for checkout." },
      { status: 400 }
    );
  }

  if (hasActivePaidSubscription(user)) {
    return NextResponse.json(
      { error: "You already have an active paid subscription." },
      { status: 409 }
    );
  }

  const stripe = getStripe();

  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: {
        userId: user.id,
      },
    });

    customerId = customer.id;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customer.id,
      },
    });
  }

  const baseUrl = getBaseUrl(request);
  const successUrl = new URL("/dashboard?upgraded=true", baseUrl).toString();
  const cancelUrl = new URL("/pricing", baseUrl).toString();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      plan: requestedPlan,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: requestedPlan,
      },
    },
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "Stripe Checkout URL could not be created." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkoutSession.url });
}
