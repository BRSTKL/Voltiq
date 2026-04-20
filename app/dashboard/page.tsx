import Link from "next/link";
import { redirect } from "next/navigation";
import { Plan } from "@prisma/client";

import { auth } from "@/auth";
import AuthButton from "@/components/AuthButton";
import AppNav from "@/components/layout/AppNav";
import { StatCard } from "@/components/ui/StatCard";
import prisma from "@/lib/prisma";
import {
  DEFAULT_QUICK_ACCESS_TOOLS,
  type ToolDefinition,
  getToolDefinitions,
  getSavedCalculationHref,
  getToolDefinition,
  getToolName,
} from "@/lib/toolRegistry";

type AllTimeUsageGroup = {
  toolSlug: string;
  _count: { _all: number };
};

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
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPlanBadgeClasses(plan: Plan) {
  if (plan === Plan.ENTERPRISE) {
    return "bg-[rgba(59,130,246,0.18)] text-[#BFDBFE]";
  }

  if (plan === Plan.PRO) {
    return "bg-[rgba(245,158,11,0.18)] text-[#FDE68A]";
  }

  return "bg-[rgba(107,114,128,0.2)] text-[#D1D5DB]";
}

function getQuickLaunchTools(allTimeUsageGroups: AllTimeUsageGroup[]) {
  const seen = new Set<string>();
  const rankedTools = allTimeUsageGroups
    .map((item) => getToolDefinition(item.toolSlug))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
  const fallbackTools = [...DEFAULT_QUICK_ACCESS_TOOLS, ...getToolDefinitions()];
  const quickLaunchTools: ToolDefinition[] = [];

  for (const tool of [...rankedTools, ...fallbackTools]) {
    if (seen.has(tool.slug)) {
      continue;
    }

    seen.add(tool.slug);
    quickLaunchTools.push(tool);

    if (quickLaunchTools.length === 6) {
      break;
    }
  }

  return quickLaunchTools;
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
  const quickLaunchTools = getQuickLaunchTools(allTimeUsage);
  const displayName =
    user.name?.trim() ||
    session.user.name?.trim() ||
    user.email?.split("@")[0] ||
    "Voltiq";

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#F8F8F2]">
      <AppNav>
        <AuthButton />
      </AppNav>

      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        <header className="mb-6">
          <h1 className="font-display text-[24px] font-semibold text-[#F8F8F2]">
            {"Ho\u015F geldin, "}
            {displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#9CA3AF]">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPlanBadgeClasses(
                user.plan
              )}`}
            >
              {formatPlan(user.plan)}
            </span>
            <span>{"plan\u0131ndas\u0131n\u0131z"}</span>
          </div>

          {searchParams?.upgraded === "true" ? (
            <div className="card-surface mt-4 rounded-xl border border-[#1D9E75]/40 bg-[rgba(29,158,117,0.1)] px-4 py-3 text-sm text-[#D1FAE5]">
              Stripe checkout completed. Your plan will update as soon as the
              webhook confirms the subscription.
            </div>
          ) : null}
        </header>

        {user.plan === Plan.FREE ? (
          <section className="card-surface mb-6 flex flex-col gap-4 rounded-xl border-[#F59E0B] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#F59E0B]">
                {"\u26A1 Pro'ya Y\u00FCkseltin"}
              </p>
              <p className="mt-1 text-sm text-[#9CA3AF]">
                {"PTF tahmininin kilidini a\u00E7\u0131n ve tam ge\u00E7mi\u015Fe eri\u015Fin"}
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#D97706]"
            >
              {"Y\u00FCkselt \u2192"}
            </Link>
          </section>
        ) : null}

        <section className="card-surface mb-6 flex flex-col gap-4 rounded-xl border-l-4 border-l-[#F59E0B] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-[rgba(245,158,11,0.18)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#FDE68A]">
              NEW
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold text-[#F8F8F2]">
              {"T\u00FCrkiye G\u00FCn \u00D6ncesi Market Dashboard"}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {"PTF e\u011Filimlerini, g\u00FCnl\u00FCk de\u011Fi\u015Fimleri ve saatlik paternleri tek ekranda inceleyin."}
            </p>
          </div>
          <Link
            href="/tools/market-dashboard"
            className="inline-flex items-center text-sm font-semibold text-[#F59E0B] transition hover:text-[#F8F8F2]"
          >
            {"A\u00E7 \u2192"}
          </Link>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Plan" value={formatPlan(user.plan)} />
          <StatCard label="Bu ay hesap" value={monthlyCalculationCount} />
          <StatCard label={"Kullan\u0131lan ara\u00E7"} value={monthlyUsage.length} />
          <StatCard label="Kaydedilen hesap" value={savedCalculations.length} />
        </section>

        <section className="mb-10">
          <h2 className="section-label mb-4">{"Kaydedilen Hesaplamalar"}</h2>

          {savedCalculations.length === 0 ? (
            <div className="card-surface rounded-xl px-5 py-6 text-sm text-[#9CA3AF]">
              {"Hen\u00FCz hesaplama kaydedilmedi"}
            </div>
          ) : (
            <div className="space-y-4">
              {savedCalculations.map((calculation) => (
                <div
                  key={calculation.id}
                  className="card-surface rounded-xl p-5 transition-colors hover:border-[#374151]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-[#F8F8F2]">
                        {getToolName(calculation.toolSlug)}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#9CA3AF]">
                        {calculation.title}
                      </p>
                      <p className="mt-3 font-mono text-xs text-[#6B7280]">
                        {formatTimestamp(calculation.createdAt)}
                      </p>
                    </div>

                    <Link
                      href={getSavedCalculationHref(
                        calculation.toolSlug,
                        calculation.id
                      )}
                      className="inline-flex items-center text-sm font-semibold text-[#F59E0B] transition hover:text-[#F8F8F2]"
                    >
                      {"Geri y\u00FCkle \u2192"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-label mb-4">{"H\u0131zl\u0131 Ba\u015Flat"}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickLaunchTools.map((tool) => (
              <Link
                key={tool.slug}
                href={tool.href}
                className="card-surface rounded-xl p-4 transition hover:border-[#374151] hover:bg-[#151520]"
              >
                <div className="flex h-full flex-col">
                  <span className="inline-flex w-fit rounded-full bg-[rgba(245,158,11,0.18)] px-2.5 py-1 text-[11px] font-semibold text-[#FDE68A]">
                    {tool.categoryLabel}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[#F8F8F2]">
                    {tool.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#9CA3AF]">
                    {tool.description}
                  </p>
                  <span className="mt-4 text-sm font-semibold text-[#F59E0B]">
                    {"A\u00E7 \u2192"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
