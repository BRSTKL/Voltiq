export interface EPIASPricePoint {
  date: string;
  hour: number;
  ptf: number;
  smf?: number;
}

export class EPIASError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "EPIASError";
  }
}

const BASE_URL = "https://api.epias.com.tr/epias/exchange/transparency";

type EPIASResponseItem = {
  date?: unknown;
  hour?: unknown;
  marketTradePrice?: unknown;
  smp?: unknown;
};

type EPIASResponse = {
  body?: {
    dayAheadMCPList?: EPIASResponseItem[];
  };
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

function normalizeDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new EPIASError(`EPİAŞ returned an invalid date value: ${value}`);
  }

  return formatDateKey(startOfUtcDay(parsed));
}

function normalizeHour(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new EPIASError("EPİAŞ returned an invalid hour value.");
  }

  if (value >= 0 && value <= 23) {
    return value;
  }

  if (value >= 1 && value <= 24) {
    return value - 1;
  }

  throw new EPIASError(`EPİAŞ returned an out-of-range hour: ${value}`);
}

function normalizeRequiredNumeric(value: unknown, fieldName: string) {
  if (value == null) {
    throw new EPIASError(`EPİAŞ response is missing ${fieldName}.`);
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new EPIASError(`EPİAŞ returned an invalid ${fieldName} value.`);
  }

  return value;
}

function normalizeOptionalNumeric(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined;
  }

  return normalizeRequiredNumeric(value, fieldName);
}

/**
 * Fetches day-ahead market clearing price (PTF) data from EPİAŞ Transparency Platform.
 * @param startDate - 'YYYY-MM-DD' format
 * @param endDate   - 'YYYY-MM-DD' format
 */
export async function fetchDayAheadMCP(
  startDate: string,
  endDate: string
): Promise<EPIASPricePoint[]> {
  const url = new URL(`${BASE_URL}/market/day-ahead-mcp`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new EPIASError(
        `EPİAŞ request failed with status ${response.status}.`,
        response.status
      );
    }

    let payload: EPIASResponse;

    try {
      payload = (await response.json()) as EPIASResponse;
    } catch {
      throw new EPIASError(
        "EPİAŞ returned malformed JSON.",
        response.status
      );
    }

    const dayAheadMCPList = payload.body?.dayAheadMCPList;

    if (!Array.isArray(dayAheadMCPList)) {
      throw new EPIASError(
        "EPİAŞ response body is missing dayAheadMCPList.",
        response.status
      );
    }

    return dayAheadMCPList
      .map((item) => ({
        date: normalizeDate(String(item.date ?? "")),
        hour: normalizeHour(item.hour),
        ptf: normalizeRequiredNumeric(item.marketTradePrice, "marketTradePrice"),
        smf: normalizeOptionalNumeric(item.smp, "smp"),
      }))
      .sort((left, right) => {
        if (left.date === right.date) {
          return left.hour - right.hour;
        }

        return left.date.localeCompare(right.date);
      });
  } catch (error) {
    if (error instanceof EPIASError) {
      throw error;
    }

    throw new EPIASError(
      error instanceof Error
        ? `EPİAŞ network request failed: ${error.message}`
        : "EPİAŞ network request failed."
    );
  }
}

export async function fetchLastNDays(n: number): Promise<EPIASPricePoint[]> {
  const totalDays = Math.max(1, Math.floor(n));
  const endDate = startOfUtcDay(new Date());
  const startDate = addUtcDays(endDate, -(totalDays - 1));

  return fetchDayAheadMCP(formatDateKey(startDate), formatDateKey(endDate));
}

/**
 * Generates deterministic mock PTF data for development/testing.
 * Turkish PTF range: 800–3500 TRY/MWh with daily and seasonal patterns.
 * Uses Math.sin() - no randomness, so results are reproducible.
 */
export function generateMockPrices(days: number): EPIASPricePoint[] {
  const totalDays = Math.max(1, Math.floor(days));
  const basePrice = 1500;
  const today = startOfUtcDay(new Date());
  const startDate = addUtcDays(today, -(totalDays - 1));
  const points: EPIASPricePoint[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const currentDay = addUtcDays(startDate, dayIndex);
    const dayOfWeek = currentDay.getUTCDay();
    const month = currentDay.getUTCMonth() + 1;

    const dayOfWeekDelta = dayOfWeek === 0 || dayOfWeek === 6 ? -200 : 100;
    const seasonalDelta = [12, 1, 2].includes(month) ? 300 : 0;

    for (let hour = 0; hour < 24; hour += 1) {
      let hourlyDelta = 0;

      if (hour >= 8 && hour <= 11) {
        hourlyDelta += 400;
      } else if (hour >= 17 && hour <= 21) {
        hourlyDelta += 600;
      } else if (hour >= 2 && hour <= 5) {
        hourlyDelta -= 400;
      }

      const microVariation = Math.sin((dayIndex + 1) * (hour + 1)) * 85;
      const rawPrice =
        basePrice + hourlyDelta + dayOfWeekDelta + seasonalDelta + microVariation;
      const ptf = Number(
        Math.min(3500, Math.max(800, rawPrice)).toFixed(1)
      );

      points.push({
        date: formatDateKey(currentDay),
        hour,
        ptf,
      });
    }
  }

  return points.sort((left, right) => {
    if (left.date === right.date) {
      return left.hour - right.hour;
    }

    return left.date.localeCompare(right.date);
  });
}
