import { NextResponse } from "next/server";
import { Plan } from "@prisma/client";
import type Stripe from "stripe";

import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type CheckoutPlan = "PRO" | "ENTERPRISE";

function parsePlan(plan: unknown) {
  if (plan === "PRO") {
    return Plan.PRO;
  }

  if (plan === "ENTERPRISE") {
    return Plan.ENTERPRISE;
  }

  throw new Error("Invalid plan metadata on Stripe event.");
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId || session.client_reference_id;

  if (!userId) {
    throw new Error("Missing userId on checkout.session.completed.");
  }

  const plan = parsePlan(session.metadata?.plan);
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;

  let subscriptionStatus: string | null = null;

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    subscriptionStatus = subscription.status;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
      subscriptionStatus: subscriptionStatus ?? "active",
    },
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const subscriptionId = subscription.id;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: Plan.FREE,
      stripeSubscriptionId: null,
      subscriptionStatus: subscription.status,
    },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration." },
      { status: 400 }
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("[Stripe Webhook] Signature verification failed:", error);
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
