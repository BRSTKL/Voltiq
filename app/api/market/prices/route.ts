import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { generateMockPrices } from "@/lib/epias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampDays(value: string | null, fallback: number, max: number) {
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return startOfUtcDay(next);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildResponse(
  prices: Array<{ date: string; hour: number; ptf: number; smf?: number }>,
  fromDate: string,
  toDate: string,
  isMock: boolean
) {
  return NextResponse.json(
    {
      prices,
      meta: {
        count: prices.length,
        fromDate,
        toDate,
        isMock,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const days = clampDays(request.nextUrl.searchParams.get("days"), 30, 365);
  const toDate = startOfUtcDay(new Date());
  const fromDate = addUtcDays(toDate, -(days - 1));

  let records = [] as Awaited<ReturnType<typeof prisma.marketPrice.findMany>>;

  try {
    records = await prisma.marketPrice.findMany({
      where: {
        date: {
          gte: fromDate,
        },
      },
      orderBy: [{ date: "asc" }, { hour: "asc" }],
    });
  } catch {
    records = [];
  }

  if (records.length === 0) {
    return buildResponse(
      generateMockPrices(days),
      formatDateKey(fromDate),
      formatDateKey(toDate),
      true
    );
  }

  const prices = records.map((record) => ({
    date: formatDateKey(record.date),
    hour: record.hour,
    ptf: record.ptf,
    smf: record.smf ?? undefined,
  }));

  return buildResponse(prices, formatDateKey(fromDate), formatDateKey(toDate), false);
}
