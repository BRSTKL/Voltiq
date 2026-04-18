import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  EPIASError,
  fetchLastNDays,
  generateMockPrices,
} from "@/lib/epias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncBody = {
  days?: unknown;
};

function clampDays(value: unknown, fallback: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function toDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");

  return (
    authorization === `Bearer ${secret}` ||
    cronSecret === secret
  );
}

async function parsePostBody(request: Request): Promise<SyncBody> {
  try {
    return (await request.json()) as SyncBody;
  } catch {
    return {};
  }
}

async function handleSync(days: number) {
  let pricePoints;
  let isMock = false;

  try {
    pricePoints = await fetchLastNDays(days);
  } catch (error) {
    if (!(error instanceof EPIASError)) {
      throw error;
    }

    pricePoints = generateMockPrices(days);
    isMock = true;
  }

  let synced = 0;
  let errors = 0;

  for (const point of pricePoints) {
    try {
      await prisma.marketPrice.upsert({
        where: {
          date_hour: {
            date: toDateOnly(point.date),
            hour: point.hour,
          },
        },
        update: {
          ptf: point.ptf,
          smf: point.smf ?? null,
        },
        create: {
          date: toDateOnly(point.date),
          hour: point.hour,
          ptf: point.ptf,
          smf: point.smf ?? null,
        },
      });

      synced += 1;
    } catch {
      errors += 1;
    }
  }

  return NextResponse.json({
    synced,
    errors,
    isMock,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const days = clampDays(request.nextUrl.searchParams.get("days"), 7, 30);
  return handleSync(days);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await parsePostBody(request);
  const days = clampDays(body.days, 7, 30);
  return handleSync(days);
}
