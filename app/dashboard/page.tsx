import Link from "next/link";
import { redirect } from "next/navigation";
import { Plan } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  DEFAULT_QUICK_ACCESS_TOOLS,
  getSavedCalculationHref,
  getToolDefinition,
  getToolName,
} from "@/lib/toolRegistry";

function getUtcMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatPlan(plan: Plan) {
  if (plan === Plan.ENTERPRISE) {
    return "ENTERPRISE";
  }

  if (plan === Plan.PRO) {
    return "PRO";
  }

  return "FREE";
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { upgraded?: string };
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`);
  }

  const monthStart = getUtcMonthStart();

  const [user, monthlyUsageGroups, allTimeUsageGroups, savedCalculations] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
        },
      }),
      prisma.usageLog.groupBy({
        by: ["toolSlug"],
        where: {
          userId: session.user.id,
          createdAt: {
            gte: monthStart,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.usageLog.groupBy({
        by: ["toolSlug"],
        where: {
          userId: session.user.id,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.savedCalculation.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          toolSlug: true,
          title: true,
          createdAt: true,
        },
      }),
    ]);

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`);
  }

  const monthlyUsage = [...monthlyUsageGroups].sort(
    (left, right) => right._count._all - left._count._all
  );
  const allTimeUsage = [...allTimeUsageGroups].sort(
    (left, right) => right._count._all - left._count._all
  );

  const monthlyCalculationCount = monthlyUsage.reduce(
    (total, item) => total + item._count._all,
    0
  );

  const quickAccessTools =
    allTimeUsage.length > 0
      ? allTimeUsage
          .slice(0, 3)
          .map((item) => ({
            ...getToolDefinition(item.toolSlug),
            count: item._count._all,
          }))
          .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
      : DEFAULT_QUICK_ACCESS_TOOLS.map((tool) => ({
          ...tool,
          count: 0,
        }));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,158,117,0.16),_transparent_32%),linear-gradient(180deg,_#06100d_0%,_#0c1713_100%)] text-[#E5F4EE]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Link href="/" className="inline-flex items-center gap-3 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--color-brand)] text-sm font-semibold">
                  V
                </span>
                <span className="text-xl font-semibold tracking-[-0.03em]">Voltiq</span>
              </Link>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8FC9B7]">
                  Dashboard
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Welcome back{user.name ? `, ${user.name}` : ""}.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-[#A7C2B8]">
                  Review your plan, usage, and saved calculations from one place.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/tools"
                className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10"
              >
                Open tools
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
              >
                View pricing
              </Link>
            </div>
          </div>

          {searchParams?.upgraded === "true" ? (
            <div className="rounded-[20px] border border-[#1D9E75]/35 bg-[#1D9E75]/14 px-4 py-3 text-sm text-[#D5F5E9]">
              Stripe checkout completed. Your plan will update as soon as the webhook confirms the subscription.
            </div>
          ) : null}
        </header>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8FC9B7]">
                  Current plan
                </p>
                <div className="inline-flex items-center rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/12 px-3 py-1 text-sm font-semibold text-[#BDEDDC]">
                  {formatPlan(user.plan)}
                </div>
                <p className="text-sm leading-7 text-[#A7C2B8]">
                  {user.plan === Plan.FREE
                    ? "Upgrade to unlock unlimited calculations and every Voltiq tool."
                    : "Your account already has access to premium workflows."}
                </p>
              </div>

              {user.plan === Plan.FREE ? (
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
                >
                  Upgrade plan
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8FC9B7]">
              This month
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#88A79C]">
                  Calculations
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
                  {monthlyCalculationCount}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#88A79C]">
                  Tools used
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
                  {monthlyUsage.length}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8FC9B7]">
                  Usage breakdown
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                  Tools used this month
                </h2>
              </div>
              <p className="text-sm text-[#88A79C]">
                Since {formatTimestamp(monthStart)}
              </p>
            </div>

            {monthlyUsage.length > 0 ? (
              <div className="mt-6 space-y-4">
                {monthlyUsage.map((item) => (
                  <div
                    key={item.toolSlug}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        {getToolName(item.toolSlug)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#88A79C]">
                        {item.toolSlug}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-white">
                        {item._count._all}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#88A79C]">
                        runs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 px-4 py-5 text-sm leading-7 text-[#A7C2B8]">
                No calculations yet this month. Open a tool to start building your activity history.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8FC9B7]">
              Quick access
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              Most used tools
            </h2>

            <div className="mt-6 grid gap-4">
              {quickAccessTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={tool.href}
                  className="rounded-[20px] border border-white/10 bg-white/5 p-5 transition-colors duration-200 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">{tool.name}</p>
                      <p className="mt-2 text-sm leading-6 text-[#A7C2B8]">
                        {tool.count > 0
                          ? `${tool.count} total runs`
                          : "Recommended starting point"}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#BDEDDC]">
                      Open
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0f1b17]/85 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8FC9B7]">
                Saved calculations
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                Latest snapshots
              </h2>
            </div>
            <p className="text-sm text-[#88A79C]">Last 10 entries</p>
          </div>

          {savedCalculations.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-[22px] border border-white/10">
              <div className="hidden grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr] gap-4 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#88A79C] md:grid">
                <span>Tool</span>
                <span>Title</span>
                <span>Date</span>
                <span>Action</span>
              </div>

              <div className="divide-y divide-white/10">
                {savedCalculations.map((calculation) => (
                  <div
                    key={calculation.id}
                    className="grid gap-3 bg-transparent px-5 py-4 md:grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {getToolName(calculation.toolSlug)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#88A79C] md:hidden">
                        Tool
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#DDEBE6]">{calculation.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#88A79C] md:hidden">
                        Title
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#A7C2B8]">
                        {formatTimestamp(calculation.createdAt)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#88A79C] md:hidden">
                        Date
                      </p>
                    </div>
                    <div>
                      <Link
                        href={getSavedCalculationHref(
                          calculation.toolSlug,
                          calculation.id
                        )}
                        className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 px-4 py-5 text-sm leading-7 text-[#A7C2B8]">
              You have not saved any calculations yet. After a tool finishes, use the new
              save button to keep a reusable snapshot here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
