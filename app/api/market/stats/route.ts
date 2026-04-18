import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { generateMockPrices } from "@/lib/epias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PricePoint = {
  date: string;
  hour: number;
  ptf: number;
};

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

function round1(value: number) {
  return Number(value.toFixed(1));
}

function average(points: PricePoint[]) {
  if (points.length === 0) {
    return 0;
  }

  return points.reduce((sum, point) => sum + point.ptf, 0) / points.length;
}

function findExtreme(points: PricePoint[], mode: "max" | "min") {
  return points.reduce((selected, point) => {
    if (!selected) {
      return point;
    }

    if (mode === "max") {
      return point.ptf > selected.ptf ? point : selected;
    }

    return point.ptf < selected.ptf ? point : selected;
  }, null as PricePoint | null);
}

export async function GET() {
  const today = startOfUtcDay(new Date());
  const yesterday = addUtcDays(today, -1);

  let isMock = false;
  let todayPrices: PricePoint[];
  let yesterdayPrices: PricePoint[];

  try {
    const [todayRecords, yesterdayRecords] = await Promise.all([
      prisma.marketPrice.findMany({
        where: { date: today },
        orderBy: { hour: "asc" },
      }),
      prisma.marketPrice.findMany({
        where: { date: yesterday },
        orderBy: { hour: "asc" },
      }),
    ]);

    if (todayRecords.length > 0) {
      todayPrices = todayRecords.map((record) => ({
        date: formatDateKey(record.date),
        hour: record.hour,
        ptf: record.ptf,
      }));
      yesterdayPrices = yesterdayRecords.map((record) => ({
        date: formatDateKey(record.date),
        hour: record.hour,
        ptf: record.ptf,
      }));
    } else {
      throw new Error("No market prices found for today.");
    }
  } catch {
    isMock = true;

    const mockPoints = generateMockPrices(2);
    const dates = [...new Set(mockPoints.map((point) => point.date))];
    const todayKey = dates[dates.length - 1];
    const yesterdayKey = dates[dates.length - 2] ?? todayKey;

    todayPrices = mockPoints.filter((point) => point.date === todayKey);
    yesterdayPrices = mockPoints.filter((point) => point.date === yesterdayKey);
  }

  const todayAverageRaw = average(todayPrices);
  const fallbackYesterdayAverage = todayAverageRaw;
  const yesterdayAverageRaw =
    yesterdayPrices.length > 0 ? average(yesterdayPrices) : fallbackYesterdayAverage;

  const todayMax = findExtreme(todayPrices, "max");
  const todayMin = findExtreme(todayPrices, "min");
  const vsYesterday =
    yesterdayAverageRaw === 0
      ? 0
      : Number(
          (((todayAverageRaw - yesterdayAverageRaw) / yesterdayAverageRaw) * 100).toFixed(1)
        );

  const direction =
    vsYesterday > 1 ? "up" : vsYesterday < -1 ? "down" : "stable";

  return NextResponse.json(
    {
      todayAvg: round1(todayAverageRaw),
      todayMax: todayMax
        ? { ptf: round1(todayMax.ptf), hour: todayMax.hour }
        : { ptf: 0, hour: 0 },
      todayMin: todayMin
        ? { ptf: round1(todayMin.ptf), hour: todayMin.hour }
        : { ptf: 0, hour: 0 },
      yesterdayAvg: round1(yesterdayAverageRaw),
      vsYesterday,
      direction,
      isMock,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=1800",
      },
    }
  );
}
