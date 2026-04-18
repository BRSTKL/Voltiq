import { Plan } from "@prisma/client";

import prisma from "@/lib/prisma";

export const FREE_TOOLS = ["solar", "battery", "roi"] as const;

export type UsageLimitReason = "tool_locked" | "daily_limit";

export type UsageCheckResult = {
  allowed: boolean;
  reason?: UsageLimitReason;
};

const FREE_DAILY_LIMIT = 20;

function normalizePlan(plan: string): Plan {
  if (plan === Plan.PRO) {
    return Plan.PRO;
  }

  if (plan === Plan.ENTERPRISE) {
    return Plan.ENTERPRISE;
  }

  return Plan.FREE;
}

function normalizeToolSlug(toolSlug: string) {
  return toolSlug.trim().toLowerCase();
}

function getUtcDayStart(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export async function checkUsageLimit(
  userId: string,
  toolSlug: string,
  plan: string
): Promise<UsageCheckResult> {
  const normalizedPlan = normalizePlan(plan);
  const normalizedToolSlug = normalizeToolSlug(toolSlug);

  if (normalizedPlan === Plan.PRO || normalizedPlan === Plan.ENTERPRISE) {
    return { allowed: true };
  }

  if (
    !FREE_TOOLS.includes(
      normalizedToolSlug as (typeof FREE_TOOLS)[number]
    )
  ) {
    return {
      allowed: false,
      reason: "tool_locked",
    };
  }

  const usageCount = await prisma.usageLog.count({
    where: {
      userId,
      createdAt: {
        gte: getUtcDayStart(),
      },
    },
  });

  if (usageCount >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "daily_limit",
    };
  }

  return { allowed: true };
}

export async function incrementUsage(userId: string, toolSlug: string) {
  await prisma.usageLog.create({
    data: {
      userId,
      toolSlug: normalizeToolSlug(toolSlug),
    },
  });
}
