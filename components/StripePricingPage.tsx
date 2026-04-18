"use client";

import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  Check,
  Crown,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type BillingPlan = "FREE" | "PRO" | "ENTERPRISE";

type PricingTier = {
  plan: BillingPlan;
  name: string;
  price: string;
  subtitle: string;
  description: string;
  features: string[];
  accent: string;
  badge?: string;
};

const TIERS: PricingTier[] = [
  {
    plan: "FREE",
    name: "Free",
    price: "$0",
    subtitle: "Start with the essential calculators.",
    description:
      "For solo builders validating renewable energy projects before they need the full toolkit.",
    features: [
      "20 calculations per UTC day",
      "Access to Solar, Battery, and ROI tools",
      "Secure login and dashboard access",
    ],
    accent: "border-gray-800 bg-gray-900/70",
  },
  {
    plan: "PRO",
    name: "Pro",
    price: "$29",
    subtitle: "Unlock every tool for monthly project work.",
    description:
      "Best for consultants and engineers who need unlimited usage across the full Voltiq stack.",
    features: [
      "Unlimited calculations",
      "Access to every Voltiq tool",
      "Stripe-managed monthly subscription",
    ],
    accent: "border-emerald-500/40 bg-emerald-500/8 ring-1 ring-emerald-500/20",
    badge: "Most popular",
  },
  {
    plan: "ENTERPRISE",
    name: "Enterprise",
    price: "$99",
    subtitle: "Full platform access plus API usage.",
    description:
      "For teams that want unlimited calculations, API connectivity, and a higher-throughput setup.",
    features: [
      "Everything in Pro",
      "API access",
      "Built for internal teams and integrations",
    ],
    accent: "border-cyan-500/30 bg-cyan-500/8",
  },
];

const VALUE_POINTS = [
  {
    title: "All engineering tools in one place",
    body: "Upgrade once and move across solar sizing, battery workflows, LCOE, cable sizing, and the rest of the Voltiq toolkit.",
    icon: Sparkles,
  },
  {
    title: "Unlimited usage for paid plans",
    body: "Pro and Enterprise remove the daily cap so your team can iterate on calculations without watching the meter.",
    icon: Rocket,
  },
  {
    title: "Enterprise-ready API path",
    body: "Enterprise includes API access so you can bring Voltiq outputs into your own products and internal workflows.",
    icon: ShieldCheck,
  },
];

function isPaidPlan(plan: BillingPlan) {
  return plan === "PRO" || plan === "ENTERPRISE";
}

function formatPlanLabel(plan: BillingPlan) {
  if (plan === "ENTERPRISE") {
    return "Enterprise";
  }

  if (plan === "PRO") {
    return "Pro";
  }

  return "Free";
}

type PricingButtonProps = {
  tier: PricingTier;
  currentPlan: BillingPlan;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  isAlreadyPaid: boolean;
  pendingPlan: BillingPlan | null;
  onCheckout: (plan: Exclude<BillingPlan, "FREE">) => Promise<void>;
};

function PricingButton({
  tier,
  currentPlan,
  isAuthenticated,
  isLoadingSession,
  isAlreadyPaid,
  pendingPlan,
  onCheckout,
}: PricingButtonProps) {
  const isCurrentPlan = currentPlan === tier.plan;
  const isPending = pendingPlan === tier.plan;

  if (tier.plan === "FREE") {
    return (
      <Link
        href="/tools"
        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-gray-600 hover:bg-gray-800/80"
      >
        {isCurrentPlan && isAuthenticated ? "Free plan active" : "Start free"}
      </Link>
    );
  }

  const disabled = isLoadingSession || isPending || isCurrentPlan || isAlreadyPaid;
  let label = tier.plan === "PRO" ? "Upgrade to Pro" : "Upgrade to Enterprise";

  if (isLoadingSession) {
    label = "Checking...";
  } else if (isPending) {
    label = "Redirecting...";
  } else if (isCurrentPlan) {
    label = "Current plan";
  } else if (isAlreadyPaid) {
    label = "Already subscribed";
  } else if (!isAuthenticated) {
    label = "Login to upgrade";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (tier.plan !== "FREE") {
          void onCheckout(tier.plan);
        }
      }}
      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-400"
    >
      {label}
    </button>
  );
}

type PricingCardProps = PricingButtonProps & {
  tier: PricingTier;
};

function PricingCard(props: PricingCardProps) {
  const { tier, currentPlan } = props;
  const isCurrentPlan = currentPlan === tier.plan;

  return (
    <article className={`relative flex h-full flex-col gap-6 rounded-3xl border p-6 ${tier.accent}`}>
      {tier.badge ? (
        <div className="absolute -top-3 left-6 inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
          {tier.badge}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
              {tier.name}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              {tier.price}
              <span className="ml-1 text-base font-medium text-gray-400">/ month</span>
            </h2>
          </div>
          {isCurrentPlan ? (
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Active
            </span>
          ) : null}
        </div>

        <p className="text-sm font-medium text-gray-200">{tier.subtitle}</p>
        <p className="text-sm leading-relaxed text-gray-400">{tier.description}</p>
      </div>

      <PricingButton {...props} />

      <ul className="space-y-3 border-t border-white/10 pt-5">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-gray-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function StripePricingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";
  const isLoadingSession = status === "loading";
  const currentPlan = isAuthenticated
    ? ((session?.user?.plan ?? "FREE") as BillingPlan)
    : "FREE";
  const isAlreadyPaid = useMemo(() => isPaidPlan(currentPlan), [currentPlan]);

  async function handleCheckout(plan: Exclude<BillingPlan, "FREE">) {
    setErrorMessage(null);

    if (!isAuthenticated) {
      await router.push(`/login?callbackUrl=${encodeURIComponent("/pricing")}`);
      return;
    }

    setPendingPlan(plan);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        setErrorMessage(payload.error ?? "Stripe checkout could not be started.");
        return;
      }

      window.location.assign(payload.url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected checkout error."
      );
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <>
      <Head>
        <title>Pricing | Voltiq</title>
        <meta
          name="description"
          content="Upgrade Voltiq with Stripe Checkout. Choose Free, Pro, or Enterprise monthly access."
        />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-14 sm:px-6 lg:px-8">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,rgba(17,24,39,0.96),rgba(3,7,18,1))] p-8 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  Stripe billing
                </span>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    Choose the Voltiq plan that matches your project velocity.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-gray-300">
                    Start free with the core calculators, upgrade to Pro for unlimited access
                    across the full tool suite, or move to Enterprise when you need API
                    connectivity.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-200">
                    {isAuthenticated
                      ? `Current plan: ${formatPlanLabel(currentPlan)}`
                      : "Sign in to upgrade instantly"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">
                    Secure checkout powered by Stripe
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/tools"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-400"
                  >
                    Explore tools
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10"
                  >
                    Open dashboard
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                    <Crown className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Plan snapshot</p>
                    <p className="text-sm text-gray-400">
                      Paid plans are billed monthly and activate after the Stripe webhook confirms the checkout.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Free
                    </p>
                    <p className="mt-2 text-sm text-gray-300">20 calculations per UTC day on the core set.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Pro
                    </p>
                    <p className="mt-2 text-sm text-gray-300">Unlimited calculations across the full catalog.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                      Enterprise
                    </p>
                    <p className="mt-2 text-sm text-gray-300">Everything in Pro plus API access for integrations.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {errorMessage ? (
            <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
              {errorMessage}
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <PricingCard
                key={tier.plan}
                tier={tier}
                currentPlan={currentPlan}
                isAuthenticated={isAuthenticated}
                isLoadingSession={isLoadingSession}
                isAlreadyPaid={isAlreadyPaid}
                pendingPlan={pendingPlan}
                onCheckout={handleCheckout}
              />
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            {VALUE_POINTS.map((point) => {
              const Icon = point.icon;

              return (
                <article
                  key={point.title}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
                    <Icon className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-white">{point.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{point.body}</p>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
