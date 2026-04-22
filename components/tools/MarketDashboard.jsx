"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getToolDefinitions } from "@/lib/toolRegistry";
import { Badge, PanelCard, SectionLabel } from "@/components/ui";
import { StatCard } from "@/components/ui/StatCard";

const TIME_RANGE_OPTIONS = [
  { key: "today", label: "Bug\u00fcn", days: 1 },
  { key: "7", label: "7 G\u00fcn", days: 7 },
  { key: "30", label: "30 G\u00fcn", days: 30 },
  { key: "90", label: "90 G\u00fcn", days: 90 },
];

const RELATED_TOOL_SLUGS = ["solar", "lcoe", "battery"];
const MARKET_FETCH_WARNING =
  "EP\u0130A\u015e verisi y\u00fcklenemedi \u2014 mock veri g\u00f6steriliyor";

const RELATED_TOOL_META = {
  solar: {
    description:
      "G\u00fcne\u015f verim tahmini ve lokasyon bazl\u0131 \u00fcretim analizi.",
    category: "Solar",
    badgeColor: "amber",
  },
  lcoe: {
    description:
      "Teknolojiler aras\u0131 maliyet k\u0131yas\u0131 ve senaryo bazl\u0131 karl\u0131l\u0131k g\u00f6r\u00fcn\u00fcm\u00fc.",
    category: "Financial",
    badgeColor: "green",
  },
  battery: {
    description:
      "Depolama kapasitesi, DoD ve sistem yap\u0131land\u0131rma kararlar\u0131 i\u00e7in h\u0131zl\u0131 boyutland\u0131rma.",
    category: "Storage",
    badgeColor: "blue",
  },
};

const WEEKDAY_LABELS = ["Pzt", "Sal", "\u00c7ar", "Per", "Cum", "Cmt", "Paz"];

const TOOLTIP_STYLE = {
  backgroundColor: "#1A1A24",
  border: "1px solid #1E1E2E",
  borderRadius: "12px",
  color: "#F8F8F2",
};

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function formatShortDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatAxisDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatChartValue(value) {
  if (typeof value !== "number") {
    return "-";
  }

  return `${formatNumber(value)} TRY/MWh`;
}

function round1(value) {
  return Number(value.toFixed(1));
}

function getTimeRangeDays(rangeKey) {
  return (
    TIME_RANGE_OPTIONS.find((option) => option.key === rangeKey)?.days ?? 30
  );
}

function getUniqueDates(prices) {
  return [...new Set(prices.map((price) => price.date))].sort();
}

function getLatestDate(prices) {
  const uniqueDates = getUniqueDates(prices);
  return uniqueDates[uniqueDates.length - 1] ?? null;
}

function getPreviousDate(prices, currentDate) {
  const uniqueDates = getUniqueDates(prices);
  const currentIndex = uniqueDates.indexOf(currentDate);

  if (currentIndex > 0) {
    return uniqueDates[currentIndex - 1];
  }

  return uniqueDates[uniqueDates.length - 2] ?? currentDate ?? null;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDailyAverageSeries(prices) {
  const grouped = new Map();

  prices.forEach((price) => {
    const bucket = grouped.get(price.date) ?? { ptf: [], smf: [] };
    bucket.ptf.push(price.ptf);
    if (typeof price.smf === "number") {
      bucket.smf.push(price.smf);
    }
    grouped.set(price.date, bucket);
  });

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      avgPtf: round1(average(values.ptf)),
      avgSmf: values.smf.length > 0 ? round1(average(values.smf)) : null,
    }));
}

function buildHourlyMarketSeries(prices) {
  const latestDate = getLatestDate(prices);

  if (!latestDate) {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      ptf: null,
      smf: null,
    }));
  }

  const hourlyMap = new Map();

  prices.forEach((price) => {
    if (price.date === latestDate) {
      hourlyMap.set(price.hour, {
        ptf: price.ptf,
        smf: typeof price.smf === "number" ? price.smf : null,
      });
    }
  });

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    ptf: hourlyMap.get(hour)?.ptf ?? null,
    smf: hourlyMap.get(hour)?.smf ?? null,
  }));
}

function buildWeekdayPattern(prices) {
  const grouped = Array.from({ length: 7 }, () => []);

  prices.forEach((price) => {
    const weekday = (parseDateKey(price.date).getUTCDay() + 6) % 7;
    grouped[weekday].push(price.ptf);
  });

  return grouped.map((values, index) => ({
    day: WEEKDAY_LABELS[index],
    avgPtf: Number(average(values).toFixed(1)),
  }));
}

function buildHourlyPattern(prices) {
  const grouped = Array.from({ length: 24 }, () => []);

  prices.forEach((price) => {
    grouped[price.hour]?.push(price.ptf);
  });

  return grouped.map((values, hour) => ({
    hour,
    avgPtf: Number(average(values).toFixed(1)),
    isPeak: (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21),
  }));
}

function interpolateColor(start, end, factor) {
  return start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * factor)
  );
}

function getHeatmapColor(value, min, max) {
  const green = [16, 185, 129];
  const amber = [245, 158, 11];
  const red = [239, 68, 68];
  const safeRange = max - min;
  const normalized = safeRange === 0 ? 0.5 : (value - min) / safeRange;

  if (normalized <= 0.5) {
    const rgb = interpolateColor(green, amber, normalized / 0.5);
    return `rgb(${rgb.join(",")})`;
  }

  const rgb = interpolateColor(amber, red, (normalized - 0.5) / 0.5);
  return `rgb(${rgb.join(",")})`;
}

function downloadCsv(prices) {
  const csvRows = [
    "Tarih,Saat,PTF (TRY/MWh),SMF (TRY/MWh)",
    ...prices.map((price) =>
      [price.date, formatHour(price.hour), price.ptf, price.smf ?? ""].join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "voltiq-market-prices.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function sortRows(rows, sort) {
  return [...rows].sort((left, right) => {
    const direction = sort.dir === "asc" ? 1 : -1;

    if (sort.col === "ptf") {
      return (left.ptf - right.ptf) * direction;
    }

    return (left.hour - right.hour) * direction;
  });
}

function getCategoryMeta(hour) {
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
    return {
      label: "Peak",
      className: "bg-[rgba(239,68,68,0.1)] text-[#EF4444]",
    };
  }

  if (hour >= 0 && hour <= 6) {
    return {
      label: "Gece",
      className: "bg-[rgba(59,130,246,0.1)] text-[#3B82F6]",
    };
  }

  return {
    label: "Normal",
    className: "bg-[rgba(16,185,129,0.1)] text-[#10B981]",
  };
}

function generateLocalMockPrices(days) {
  const safeDays = Math.max(1, Math.floor(days));
  const now = new Date();
  const prices = [];

  for (let dayOffset = safeDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const currentDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - dayOffset
      )
    );
    const dateKey = currentDate.toISOString().slice(0, 10);
    const dailyBias = Math.sin((safeDays - dayOffset) / 3.2) * 72;

    for (let hour = 0; hour < 24; hour += 1) {
      const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21);
      const intradayWave = Math.sin(((hour - 7) / 24) * Math.PI * 2) * 110;
      const shoulderWave = Math.cos(((hour + 1) / 24) * Math.PI * 4) * 36;
      const peakPremium = isPeak ? 190 : hour >= 0 && hour <= 5 ? -95 : 0;
      const ptf = Math.max(
        520,
        round1(1780 + dailyBias + intradayWave + shoulderWave + peakPremium)
      );
      const smfNoise = Math.sin((hour + safeDays - dayOffset) * 1.3) * 84;
      const smf = Math.max(480, round1(ptf + smfNoise));

      prices.push({
        date: dateKey,
        hour,
        ptf,
        smf,
      });
    }
  }

  return prices;
}

function buildMockStats(prices) {
  const latestDate = getLatestDate(prices);

  if (!latestDate) {
    return {
      todayAvg: 0,
      todayMax: { ptf: 0, hour: 0 },
      todayMin: { ptf: 0, hour: 0 },
      yesterdayAvg: 0,
      vsYesterday: 0,
      direction: "stable",
      isMock: true,
    };
  }

  const previousDate = getPreviousDate(prices, latestDate) ?? latestDate;
  const todayPrices = prices.filter((price) => price.date === latestDate);
  const yesterdayPrices = prices.filter((price) => price.date === previousDate);
  const todayAverageRaw = average(todayPrices.map((price) => price.ptf));
  const yesterdayAverageRaw =
    yesterdayPrices.length > 0
      ? average(yesterdayPrices.map((price) => price.ptf))
      : todayAverageRaw;
  const todayMax = todayPrices.reduce((selected, price) => {
    if (!selected || price.ptf > selected.ptf) {
      return price;
    }

    return selected;
  }, null);
  const todayMin = todayPrices.reduce((selected, price) => {
    if (!selected || price.ptf < selected.ptf) {
      return price;
    }

    return selected;
  }, null);
  const vsYesterday =
    yesterdayAverageRaw === 0
      ? 0
      : round1(
          ((todayAverageRaw - yesterdayAverageRaw) / yesterdayAverageRaw) * 100
        );

  return {
    todayAvg: round1(todayAverageRaw),
    todayMax: todayMax
      ? { ptf: round1(todayMax.ptf), hour: todayMax.hour }
      : { ptf: 0, hour: 0 },
    todayMin: todayMin
      ? { ptf: round1(todayMin.ptf), hour: todayMin.hour }
      : { ptf: 0, hour: 0 },
    yesterdayAvg: round1(yesterdayAverageRaw),
    vsYesterday,
    direction: vsYesterday > 1 ? "up" : vsYesterday < -1 ? "down" : "stable",
    isMock: true,
  };
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-5 w-48 rounded bg-[#1A1A24]" />
        <div className="space-y-3">
          <div className="h-10 w-[28rem] max-w-full rounded bg-[#1A1A24]" />
          <div className="h-4 w-[24rem] max-w-full rounded bg-[#111118]" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card-surface h-24 animate-pulse" />
          ))}
        </div>
        <div className="card-surface h-[360px] animate-pulse" />
        <div className="card-surface h-[420px] animate-pulse" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card-surface h-[280px] animate-pulse" />
          <div className="card-surface h-[280px] animate-pulse" />
        </div>
        <div className="card-surface h-[420px] animate-pulse" />
        <div className="card-surface h-[260px] animate-pulse" />
      </div>
    </main>
  );
}

function ChartSkeleton({ height = 300 }) {
  return (
    <div
      className="animate-pulse rounded-[18px] border border-[#1E1E2E] bg-[#0F1117] p-4"
      style={{ height }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-end gap-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-[10px] bg-[#1A1A24]"
              style={{ height: `${40 + ((index % 5) + 2) * 16}px` }}
            />
          ))}
        </div>
        <div className="mt-5 h-4 w-40 rounded bg-[#161821]" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 lg:px-8">
      <div className="card-surface rounded-[12px] border border-[rgba(239,68,68,0.45)] p-6">
        <div className="flex items-start gap-4">
          <span className="rounded-full bg-[rgba(239,68,68,0.14)] p-3 text-[#EF4444]">
            <ExclamationTriangleIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl text-[#F8F8F2]">
              Piyasa verisi y\u00fcklenemedi
            </h1>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Dashboard verisi al\u0131namad\u0131. A\u011f ba\u011flant\u0131s\u0131n\u0131 veya API
              yan\u0131tlar\u0131n\u0131 kontrol edip yeniden deneyin.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#1E1E2E] px-4 py-2 text-sm font-medium text-[#F8F8F2] transition-colors hover:border-[#F59E0B] hover:text-[#F59E0B]"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span>Yeniden Dene</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function MarketDashboard() {
  const [stats, setStats] = useState(null);
  const [chartPrices, setChartPrices] = useState([]);
  const [baseline30DayPrices, setBaseline30DayPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("today");
  const [isSyncing, setIsSyncing] = useState(false);
  const [sort, setSort] = useState({ col: "hour", dir: "asc" });
  const [isMock, setIsMock] = useState(false);
  const [isChartRefreshing, setIsChartRefreshing] = useState(false);
  const hasLoadedInitialRange = useRef(false);

  const isProduction = process.env.NODE_ENV === "production";
  const relatedTools = getToolDefinitions().filter((tool) =>
    RELATED_TOOL_SLUGS.includes(tool.slug)
  );

  async function fetchJson(url, options) {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  function applyMockFallback(rangeKey) {
    const baselinePrices = generateLocalMockPrices(30);
    const activePrices = generateLocalMockPrices(getTimeRangeDays(rangeKey));

    setStats(buildMockStats(baselinePrices));
    setBaseline30DayPrices(baselinePrices);
    setChartPrices(activePrices);
    setIsMock(true);
    setError(MARKET_FETCH_WARNING);
  }

  async function loadInitialData() {
    setLoading(true);
    setError(null);

    try {
      const activeDays = getTimeRangeDays(timeRange);
      const [statsResponse, baselineResponse, activeResponse] = await Promise.all([
        fetchJson("/api/market/stats"),
        fetchJson("/api/market/prices?days=30"),
        fetchJson(`/api/market/prices?days=${activeDays}`),
      ]);

      setStats(statsResponse);
      setBaseline30DayPrices(baselineResponse.prices ?? []);
      setChartPrices(activeResponse.prices ?? []);
      setIsMock(
        Boolean(
          statsResponse.isMock ||
            baselineResponse.meta?.isMock ||
            activeResponse.meta?.isMock
        )
      );
    } catch (loadError) {
      console.warn(MARKET_FETCH_WARNING, loadError);
      applyMockFallback(timeRange);
    } finally {
      setLoading(false);
    }
  }

  async function loadChartRange(nextRange) {
    const days = getTimeRangeDays(nextRange);

    setIsChartRefreshing(true);
    setError(null);

    try {
      const pricesResponse = await fetchJson(`/api/market/prices?days=${days}`);
      setChartPrices(pricesResponse.prices ?? []);
      setIsMock((previous) => Boolean(previous || pricesResponse.meta?.isMock));
    } catch (loadError) {
      console.warn(MARKET_FETCH_WARNING, loadError);
      setChartPrices(generateLocalMockPrices(days));
      setIsMock(true);
      setError(MARKET_FETCH_WARNING);
    } finally {
      setIsChartRefreshing(false);
    }
  }

  async function refreshDashboardData(nextRange = timeRange) {
    try {
      const days = getTimeRangeDays(nextRange);
      const [statsResponse, baselineResponse, activeResponse] = await Promise.all([
        fetchJson("/api/market/stats"),
        fetchJson("/api/market/prices?days=30"),
        fetchJson(`/api/market/prices?days=${days}`),
      ]);

      setStats(statsResponse);
      setBaseline30DayPrices(baselineResponse.prices ?? []);
      setChartPrices(activeResponse.prices ?? []);
      setIsMock(
        Boolean(
          statsResponse.isMock ||
            baselineResponse.meta?.isMock ||
            activeResponse.meta?.isMock
        )
      );
      setError(null);
    } catch (refreshError) {
      console.warn(MARKET_FETCH_WARNING, refreshError);
      applyMockFallback(nextRange);
    }
  }

  async function handleSync() {
    if (isProduction) {
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      await fetchJson("/api/market/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": "",
        },
        body: JSON.stringify({ days: 30 }),
      });

      await refreshDashboardData();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Senkronizasyon ba\u015far\u0131s\u0131z oldu."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function handleSort(column) {
    setSort((current) => ({
      col: column,
      dir: current.col === column && current.dir === "asc" ? "desc" : "asc",
    }));
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!hasLoadedInitialRange.current) {
      hasLoadedInitialRange.current = true;
      return;
    }

    void loadChartRange(timeRange);
  }, [timeRange, loading]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error && !stats && baseline30DayPrices.length === 0) {
    return <ErrorState onRetry={() => void loadInitialData()} />;
  }

  const activePrices = chartPrices.length > 0 ? chartPrices : baseline30DayPrices;
  const isSingleDayView = getTimeRangeDays(timeRange) === 1;
  const dailySeries = buildDailyAverageSeries(activePrices);
  const todayChartSeries = buildHourlyMarketSeries(activePrices);
  const showDailySmf = dailySeries.some(
    (point) => typeof point.avgSmf === "number"
  );
  const showTodaySmf = todayChartSeries.some(
    (point) => typeof point.smf === "number"
  );
  const latestDate = getLatestDate(baseline30DayPrices);
  const todayRows = latestDate
    ? baseline30DayPrices.filter((price) => price.date === latestDate)
    : [];
  const avg30 = average(baseline30DayPrices.map((price) => price.ptf));
  const sortedTableRows = sortRows(todayRows, sort);
  const weekdaySeries = buildWeekdayPattern(baseline30DayPrices);
  const hourlySeries = buildHourlyPattern(baseline30DayPrices);
  const heatmapMin = baseline30DayPrices.reduce(
    (currentMin, price) => Math.min(currentMin, price.ptf),
    Number.POSITIVE_INFINITY
  );
  const heatmapMax = baseline30DayPrices.reduce(
    (currentMax, price) => Math.max(currentMax, price.ptf),
    Number.NEGATIVE_INFINITY
  );
  const heatmapDates = getUniqueDates(baseline30DayPrices);
  const heatmapMap = new Map(
    baseline30DayPrices.map((price) => [`${price.date}-${price.hour}`, price])
  );

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <Link href="/tools" className="transition-colors hover:text-[#F8F8F2]">
              {"\u2190 Ara\u00e7lar"}
            </Link>
            <span>{"\u203a"}</span>
            <span className="text-[#F8F8F2]">Market Intelligence</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-start">
                <h1 className="font-display text-2xl text-[#F8F8F2]">
                  {"T\u00fcrkiye G\u00fcn \u00d6ncesi Piyasas\u0131 (PTF)"}
                </h1>
                <span className="ml-3 mt-1 h-2 w-2 self-center rounded-full bg-[#10B981] animate-pulse" />
                <span className="ml-1 self-center font-mono text-xs text-[#10B981]">
                  CANLI
                </span>
              </div>
              <p className="mt-1 text-sm text-[#9CA3AF]">
                {"EP\u0130A\u015e \u015eeffafl\u0131k Platformu \u00b7 Saatlik PTF verisi \u00b7 Her saat g\u00fcncellenir"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => downloadCsv(activePrices)}
                disabled={activePrices.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1E1E2E] px-4 py-2 text-sm font-medium text-[#F8F8F2] transition-colors hover:border-[#F59E0B] hover:text-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span>{"CSV \u0130ndir"}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={isProduction || isSyncing}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1E1E2E] px-4 py-2 text-sm font-medium text-[#F8F8F2] transition-colors hover:border-[#F59E0B] hover:text-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  isProduction
                    ? "Senkronizasyon production ortam\u0131nda cron ile y\u00f6netilir."
                    : undefined
                }
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                <span>
                  {isSyncing ? "Senkronize ediliyor..." : "Senkronize Et"}
                </span>
              </button>
            </div>
          </div>

          {isProduction ? (
            <p className="text-xs text-[#6B7280]">
              Senkronizasyon production ortam\u0131nda saatlik cron ile
              y\u00f6netilir.
            </p>
          ) : null}

          {isMock ? (
            <div className="rounded-[14px] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-4 py-3 text-sm font-semibold text-[#F59E0B]">
              {"\u26a0\ufe0f Sim\u00fcle edilmi\u015f veri \u2014 Ger\u00e7ek EP\u0130A\u015e ba\u011flant\u0131s\u0131 kurulamad\u0131"}
            </div>
          ) : null}

          {error ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-3 py-2 text-xs font-semibold text-[#F59E0B]">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats ? (
            <>
              <StatCard
                label={"Bug\u00fcn Ort. PTF"}
                value={formatNumber(stats.todayAvg)}
                unit="TRY/MWh"
              />
              <StatCard
                label="24s En Y\u00fcksek"
                value={formatNumber(stats.todayMax?.ptf)}
                delta={`saat ${stats.todayMax?.hour ?? 0}:00`}
                deltaDir="neutral"
              />
              <StatCard
                label="24s En D\u00fc\u015f\u00fck"
                value={formatNumber(stats.todayMin?.ptf)}
                delta={`saat ${stats.todayMin?.hour ?? 0}:00`}
                deltaDir="neutral"
              />
              <StatCard
                label="D\u00fcnle Kar\u015f\u0131la\u015ft\u0131rma"
                value={`${Math.abs(stats.vsYesterday ?? 0)}%`}
                deltaDir={
                  stats.direction === "up"
                    ? "up"
                    : stats.direction === "down"
                      ? "down"
                      : "neutral"
                }
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="card-surface h-24 animate-pulse" />
            ))
          )}
        </div>

        <div className="card-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-label mb-4">PTF Fiyat Grafi\u011fi</p>
            </div>
            <div className="inline-flex rounded-full border border-[#1E1E2E] bg-[#111118] p-1">
              {TIME_RANGE_OPTIONS.map((option) => {
                const isActive = option.key === timeRange;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTimeRange(option.key)}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-[#F59E0B] text-black"
                        : "text-[#9CA3AF] hover:text-[#F8F8F2]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            {isChartRefreshing ? (
              <ChartSkeleton height={300} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                {isSingleDayView ? (
                  <BarChart data={todayChartSeries}>
                    <CartesianGrid
                      stroke="#1E1E2E"
                      strokeDasharray="3 3"
                      loading={isChartRefreshing}
                    />
                    <XAxis
                      dataKey="hour"
                      stroke="#6B7280"
                      tickFormatter={(hour) => formatHour(hour)}
                    />
                    <YAxis
                      stroke="#6B7280"
                      width={80}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      loading={isChartRefreshing}
                      labelFormatter={(hour) => `Saat ${formatHour(hour)}`}
                      formatter={(value, name) => [
                        formatChartValue(value),
                        name === "ptf" ? "PTF" : "SMF",
                      ]}
                    />
                    <Legend
                      loading={isChartRefreshing}
                      formatter={(value) => (value === "ptf" ? "PTF" : "SMF")}
                    />
                    <Bar
                      dataKey="ptf"
                      name="ptf"
                      fill="#F59E0B"
                      radius={[4, 4, 0, 0]}
                    />
                    {showTodaySmf ? (
                      <Bar
                        dataKey="smf"
                        name="smf"
                        fill="#10B981"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : null}
                  </BarChart>
                ) : (
                  <LineChart data={dailySeries}>
                    <CartesianGrid
                      stroke="#1E1E2E"
                      strokeDasharray="3 3"
                      loading={isChartRefreshing}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#6B7280"
                      tickFormatter={(value) => formatAxisDate(value)}
                    />
                    <YAxis
                      stroke="#6B7280"
                      width={80}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      loading={isChartRefreshing}
                      labelFormatter={(value) => formatAxisDate(value)}
                      formatter={(value, name) => [
                        formatChartValue(value),
                        name === "avgPtf" ? "Ort. PTF" : "Ort. SMF",
                      ]}
                    />
                    <Legend
                      loading={isChartRefreshing}
                      formatter={(value) =>
                        value === "avgPtf" ? "Ort. PTF" : "Ort. SMF"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="avgPtf"
                      name="avgPtf"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                    />
                    {showDailySmf ? (
                      <Line
                        type="monotone"
                        dataKey="avgSmf"
                        name="avgSmf"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    ) : null}
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-surface mt-6 overflow-x-auto p-6">
          <div className="mb-4">
            <h2 className="font-display text-xl text-[#F8F8F2]">
              {"Fiyat Is\u0131 Haritas\u0131 \u2014 Son 30 G\u00fcn"}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {"Her h\u00fccre bir saatlik PTF de\u011ferini g\u00f6sterir"}
            </p>
          </div>

          <div className="min-w-[980px]">
            <div
              className="grid gap-[2px]"
              style={{
                gridTemplateColumns: "80px repeat(24, minmax(24px, 1fr))",
              }}
            >
              <div />
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={`header-${hour}`}
                  className="pb-2 text-center font-mono text-[11px] text-[#6B7280]"
                >
                  {`${hour}h`}
                </div>
              ))}

              {heatmapDates.map((date) => (
                <Fragment key={date}>
                  <div
                    key={`${date}-label`}
                    className="pr-3 pt-1 text-right font-mono text-[11px] text-[#9CA3AF]"
                  >
                    {formatShortDate(date)}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const point = heatmapMap.get(`${date}-${hour}`);

                    return (
                      <div
                        key={`${date}-${hour}`}
                        className="aspect-square w-full rounded-[2px] bg-[#111118]"
                        style={{
                          backgroundColor: point
                            ? getHeatmapColor(point.ptf, heatmapMin, heatmapMax)
                            : "#111118",
                        }}
                        title={
                          point
                            ? `${date} ${hour}:00 \u2014 ${formatNumber(point.ptf)} TRY/MWh`
                            : `${date} ${hour}:00`
                        }
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <div
              className="h-[50px] w-[300px] rounded-[4px]"
              style={{
                background:
                  "linear-gradient(to right, #10B981, #F59E0B, #EF4444)",
              }}
            />
            <div className="flex w-[300px] justify-between">
              <span className="section-label">D\u00fc\u015f\u00fck</span>
              <span className="section-label">Orta</span>
              <span className="section-label">Y\u00fcksek</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card-surface p-6">
            <h2 className="font-display text-xl text-[#F8F8F2]">
              {"G\u00fcn Baz\u0131nda Ort. PTF"}
            </h2>
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekdaySeries}>
                  <CartesianGrid
                    stroke="#1E1E2E"
                    strokeDasharray="3 3"
                    loading={loading}
                  />
                  <XAxis dataKey="day" stroke="#6B7280" />
                  <YAxis
                    stroke="#6B7280"
                    width={80}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    loading={loading}
                    formatter={(value) => [
                      `${formatNumber(value)} TRY/MWh`,
                      "Ort. PTF",
                    ]}
                  />
                  <Bar
                    dataKey="avgPtf"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="font-display text-xl text-[#F8F8F2]">
              {"Saat Baz\u0131nda Ort. PTF"}
            </h2>
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlySeries}>
                  <CartesianGrid
                    stroke="#1E1E2E"
                    strokeDasharray="3 3"
                    loading={loading}
                  />
                  <XAxis dataKey="hour" stroke="#6B7280" />
                  <YAxis
                    stroke="#6B7280"
                    width={80}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    loading={loading}
                    labelFormatter={(label) => `Saat ${label}:00`}
                    formatter={(value) => [
                      `${formatNumber(value)} TRY/MWh`,
                      "Ort. PTF",
                    ]}
                  />
                  <Bar dataKey="avgPtf" radius={[4, 4, 0, 0]}>
                    {hourlySeries.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={entry.isPeak ? "#EF4444" : "#F59E0B"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card-surface mt-6 overflow-hidden">
          <div className="p-6">
            <h2 className="font-display text-xl text-[#F8F8F2]">
              {"Bug\u00fcn\u00fcn Saatlik Verisi"}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="bg-[#1A1A24]">
                <tr>
                  {[
                    { key: "hour", label: "Saat", sortable: true },
                    { key: "ptf", label: "PTF (TRY/MWh)", sortable: true },
                    { key: "diff", label: "30g. Ort. Fark\u0131", sortable: false },
                    { key: "category", label: "Kategori", sortable: false },
                  ].map((column) => {
                    const isActive = sort.col === column.key;
                    const arrow = isActive
                      ? sort.dir === "asc"
                        ? " \u2191"
                        : " \u2193"
                      : "";

                    return (
                      <th
                        key={column.key}
                        className={`px-6 py-4 text-left ${column.sortable ? "cursor-pointer" : ""}`}
                        onClick={
                          column.sortable ? () => handleSort(column.key) : undefined
                        }
                      >
                        <span className="section-label">
                          {`${column.label}${arrow}`}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedTableRows.map((row, index) => {
                  const deltaPercent =
                    avg30 === 0 ? 0 : ((row.ptf - avg30) / avg30) * 100;
                  const category = getCategoryMeta(row.hour);

                  return (
                    <tr
                      key={`${row.date}-${row.hour}`}
                      className={`transition-colors hover:bg-[#1A1A24] ${
                        index % 2 === 0 ? "bg-[#111118]" : "bg-[#0A0A0F]"
                      }`}
                    >
                      <td className="border-b border-[#1E1E2E] px-6 py-4 font-mono text-sm text-[#9CA3AF]">
                        {formatHour(row.hour)}
                      </td>
                      <td className="border-b border-[#1E1E2E] px-6 py-4 font-mono text-sm font-semibold text-[#F8F8F2]">
                        {formatNumber(row.ptf)}
                      </td>
                      <td
                        className={`border-b border-[#1E1E2E] px-6 py-4 text-sm font-medium ${
                          deltaPercent >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}
                      >
                        {`${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`}
                      </td>
                      <td className="border-b border-[#1E1E2E] px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${category.className}`}
                        >
                          {category.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-surface relative mt-6 overflow-hidden">
          <div className="absolute inset-0 opacity-30 blur-sm">
            <svg viewBox="0 0 900 280" className="h-full w-full">
              <path
                d="M0 180 C 90 140, 140 120, 220 160 S 360 230, 450 150 S 610 70, 700 130 S 820 220, 900 140"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(10,10,15,0.85)] text-center">
            <LockClosedIcon className="h-8 w-8 text-[#F59E0B]" />
            <h2 className="mt-3 font-display text-xl text-[#F8F8F2]">
              {"24 Saatlik PTF Tahmini"}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {"Pro planda kullan\u0131labilir"}
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex rounded-lg bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#D97706]"
            >
              {"Pro'ya Ge\u00e7 \u2192"}
            </Link>
          </div>
          <div className="h-[220px]" />
        </div>

        <div className="mt-6">
          <SectionLabel>\u0130lgili Ara\u00e7lar</SectionLabel>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {relatedTools.map((tool) => {
              const metadata = RELATED_TOOL_META[tool.slug];

              return (
                <PanelCard
                  key={tool.slug}
                  className="flex h-full flex-col gap-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge color={metadata.badgeColor}>{metadata.category}</Badge>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-lg text-[#F8F8F2]">
                      {tool.name}
                    </h3>
                    <p className="text-sm leading-6 text-[#9CA3AF]">
                      {metadata.description}
                    </p>
                  </div>
                  <Link
                    href={tool.href}
                    className="mt-auto inline-flex text-sm font-semibold text-[#F59E0B] transition-colors hover:text-[#F8F8F2]"
                  >
                    {"A\u00e7 \u2192"}
                  </Link>
                </PanelCard>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
