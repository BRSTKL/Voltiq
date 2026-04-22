export interface EPIASPricePoint {
  date: string;
  hour: number;
  ptf: number;
  smf?: number;
}

export type EPIASErrorCode =
  | "network"
  | "auth"
  | "rate_limit"
  | "not_found"
  | "invalid_response";

export class EPIASError extends Error {
  code: EPIASErrorCode;
  statusCode?: number;

  constructor(
    message: string,
    code: EPIASErrorCode = "network",
    statusCode?: number
  ) {
    super(message);
    this.name = "EPIASError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

type SystemDirection = "long" | "short" | "balanced";

type EPIASItem = Record<string, unknown>;

type EPIASListResponse = {
  items?: unknown;
  body?: {
    items?: unknown;
    dayAheadMCPList?: unknown;
  };
};

type TGTResponse = {
  tgt?: unknown;
  token?: unknown;
  expiresIn?: unknown;
};

interface TGTCache {
  token: string;
  expiresAt: number;
}

const BASE_URL =
  "https://seffaflik.epias.com.tr/electricity/electricity-service/v1";
const TGT_ENDPOINT =
  process.env.EPIAS_TGT_ENDPOINT ??
  "https://giris.epias.com.tr/cas/v1/tickets";

const TURKEY_TIMEZONE_SUFFIX = "+03:00";
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TGT_DEFAULT_TTL_MS = 60 * 60 * 1000;
const TGT_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/;

let tgtCache: TGTCache | null = null;

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeRequestDateKey(value: string, fieldName: string) {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new EPIASError(
      `EPIAS request ${fieldName} must be in YYYY-MM-DD format.`,
      "invalid_response"
    );
  }

  return value;
}

function parseDateKey(value: string) {
  const dateKey = normalizeRequestDateKey(value, "date");
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDateKey(dateKey: string, days: number) {
  const shifted = parseDateKey(dateKey);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDateKey(shifted);
}

function getTurkeyDateKey(date = new Date()) {
  return formatDateKey(new Date(date.getTime() + TURKEY_OFFSET_MS));
}

function buildTurkeyDateTime(dateKey: string, boundary: "start" | "end") {
  const normalizedDateKey = normalizeRequestDateKey(dateKey, boundary);
  const time = boundary === "start" ? "00:00:00" : "23:59:59";

  return `${normalizedDateKey}T${time}${TURKEY_TIMEZONE_SUFFIX}`;
}

function getInclusiveDayCount(startDate: string, endDate: string) {
  const startTime = parseDateKey(startDate).getTime();
  const endTime = parseDateKey(endDate).getTime();
  const diffDays = Math.floor((endTime - startTime) / DAY_IN_MS) + 1;

  return Math.max(1, diffDays);
}

function getHttpErrorCode(statusCode: number): EPIASErrorCode {
  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }

  if (statusCode === 404) {
    return "not_found";
  }

  if (statusCode === 429) {
    return "rate_limit";
  }

  return "network";
}

function buildEpiasUrl(
  pathname: string,
  queryParams: Record<string, string>
) {
  const url = new URL(`${BASE_URL}${pathname}`);

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function ensureObject(value: unknown, label: string): EPIASItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EPIASError(
      `EPIAS ${label} response is not an object.`,
      "invalid_response"
    );
  }

  return value as EPIASItem;
}

function ensureItemsArray(payload: unknown, label: string): EPIASItem[] {
  const response = ensureObject(payload, label) as EPIASListResponse;
  const items =
    response.items ??
    response.body?.items ??
    response.body?.dayAheadMCPList;

  if (!Array.isArray(items)) {
    throw new EPIASError(
      `EPIAS ${label} response is missing items.`,
      "invalid_response"
    );
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new EPIASError(
        `EPIAS ${label} response item ${index} is invalid.`,
        "invalid_response"
      );
    }

    return item as EPIASItem;
  });
}

function normalizeRequiredNumeric(value: unknown, fieldName: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new EPIASError(
    `EPIAS returned an invalid ${fieldName} value.`,
    "invalid_response"
  );
}

function normalizeOptionalNumeric(value: unknown, fieldName: string) {
  if (value == null || value === "") {
    return undefined;
  }

  return normalizeRequiredNumeric(value, fieldName);
}

function getRequiredNumericField(
  item: EPIASItem,
  fieldNames: string[],
  label: string
) {
  for (const fieldName of fieldNames) {
    if (item[fieldName] != null && item[fieldName] !== "") {
      return normalizeRequiredNumeric(item[fieldName], fieldName);
    }
  }

  throw new EPIASError(
    `EPIAS response is missing ${label}.`,
    "invalid_response"
  );
}

function getOptionalNumericField(item: EPIASItem, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    if (item[fieldName] != null && item[fieldName] !== "") {
      return normalizeOptionalNumeric(item[fieldName], fieldName);
    }
  }

  return undefined;
}

function extractDateTimeParts(value: string) {
  const trimmedValue = value.trim();
  const matched = DATE_TIME_PATTERN.exec(trimmedValue);

  if (matched) {
    return {
      date: matched[1],
      hour: matched[2] != null ? Number.parseInt(matched[2], 10) : null,
    };
  }

  const parsed = new Date(trimmedValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new EPIASError(
      `EPIAS returned an invalid date value: ${value}`,
      "invalid_response"
    );
  }

  const turkeyDate = new Date(parsed.getTime() + TURKEY_OFFSET_MS);

  return {
    date: formatDateKey(turkeyDate),
    hour: turkeyDate.getUTCHours(),
  };
}

function normalizeHourFromDateString(hour: number, originalValue: string) {
  if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
    return hour;
  }

  throw new EPIASError(
    `EPIAS returned an out-of-range hour in date value: ${originalValue}`,
    "invalid_response"
  );
}

function getDateHourFromItem(
  item: EPIASItem,
  dateFieldNames: string[] = ["date"]
) {
  for (const fieldName of dateFieldNames) {
    if (typeof item[fieldName] !== "string") {
      continue;
    }

    const rawValue = item[fieldName] as string;
    const parts = extractDateTimeParts(rawValue);

    if (parts.hour == null) {
      throw new EPIASError(
        `EPIAS ${fieldName} is missing an hour component.`,
        "invalid_response"
      );
    }

    return {
      date: parts.date,
      hour: normalizeHourFromDateString(parts.hour, rawValue),
    };
  }

  throw new EPIASError(
    "EPIAS response item is missing a valid date field.",
    "invalid_response"
  );
}

function sortPricePoints(points: EPIASPricePoint[]) {
  return [...points].sort((left, right) => {
    if (left.date === right.date) {
      return left.hour - right.hour;
    }

    return left.date.localeCompare(right.date);
  });
}

function normalizePriceItems(
  items: EPIASItem[],
  options: {
    label: string;
    priceFields: string[];
    smfFields?: string[];
    dateFields?: string[];
  }
) {
  const points = items.map((item) => {
    const { date, hour } = getDateHourFromItem(item, options.dateFields);

    return {
      date,
      hour,
      ptf: getRequiredNumericField(item, options.priceFields, options.label),
      smf: getOptionalNumericField(item, options.smfFields ?? []),
    };
  });

  return sortPricePoints(points);
}

function normalizeSystemDirectionValue(value: unknown): SystemDirection {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0) {
      return "long";
    }

    if (value < 0) {
      return "short";
    }

    return "balanced";
  }

  if (typeof value === "string" && value.trim()) {
    const trimmedValue = value.trim();

    if (trimmedValue === "1" || trimmedValue === "+1") {
      return "long";
    }

    if (trimmedValue === "-1") {
      return "short";
    }

    if (trimmedValue === "0") {
      return "balanced";
    }

    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "");

    if (
      normalized === "LONG" ||
      normalized === "SURPLUS" ||
      normalized === "ENERJIFAZLASI" ||
      normalized === "FAZLA" ||
      normalized === "1" ||
      normalized === "POSITIVE"
    ) {
      return "long";
    }

    if (
      normalized === "SHORT" ||
      normalized === "DEFICIT" ||
      normalized === "ENERJIACIGI" ||
      normalized === "ACIK" ||
      normalized === "MINUS1" ||
      normalized === "NEGATIVE"
    ) {
      return "short";
    }

    if (
      normalized === "BALANCED" ||
      normalized === "DENGEDE" ||
      normalized === "NEUTRAL" ||
      normalized === "0"
    ) {
      return "balanced";
    }
  }

  throw new EPIASError(
    "EPIAS returned an invalid system direction value.",
    "invalid_response"
  );
}

function pickSystemDirectionItem(items: EPIASItem[], dateKey: string) {
  const matchingItem = items.find((item) => {
    const rawDate =
      item.date ?? item.effectiveDate ?? item.operationDate ?? item.day;

    if (typeof rawDate !== "string") {
      return false;
    }

    try {
      return extractDateTimeParts(rawDate).date === dateKey;
    } catch {
      return false;
    }
  });

  return matchingItem ?? items[0];
}

async function parseJsonResponse(response: Response, context: string) {
  try {
    return await response.json();
  } catch {
    throw new EPIASError(
      `EPIAS ${context} returned malformed JSON.`,
      "invalid_response",
      response.status
    );
  }
}

async function getTGT(): Promise<string> {
  if (
    tgtCache &&
    Date.now() < tgtCache.expiresAt - TGT_REFRESH_MARGIN_MS
  ) {
    return tgtCache.token;
  }

  const username = process.env.EPIAS_USERNAME;
  const password = process.env.EPIAS_PASSWORD;

  if (!username || !password) {
    throw new EPIASError(
      "EPIAS_USERNAME or EPIAS_PASSWORD is missing.",
      "auth"
    );
  }

  let response: Response;

  try {
    response = await fetch(TGT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new EPIASError(
      error instanceof Error
        ? `EPIAS TGT request failed: ${error.message}`
        : "EPIAS TGT request failed.",
      "network"
    );
  }

  if (response.status === 401) {
    throw new EPIASError(
      "EPIAS authentication failed. Check credentials.",
      "auth",
      response.status
    );
  }

  if (!response.ok) {
    throw new EPIASError(
      `EPIAS TGT request failed with status ${response.status}.`,
      getHttpErrorCode(response.status),
      response.status
    );
  }

  const body = await response.text();
  let token = "";
  let expiresInMs = TGT_DEFAULT_TTL_MS;

  try {
    const parsed = JSON.parse(body) as TGTResponse | string;

    if (typeof parsed === "string") {
      token = parsed.trim();
    } else if (parsed && typeof parsed === "object") {
      if (typeof parsed.tgt === "string" && parsed.tgt.trim()) {
        token = parsed.tgt.trim();
      } else if (typeof parsed.token === "string" && parsed.token.trim()) {
        token = parsed.token.trim();
      }

      const expiresInValue =
        typeof parsed.expiresIn === "number"
          ? parsed.expiresIn
          : typeof parsed.expiresIn === "string"
            ? Number.parseFloat(parsed.expiresIn)
            : Number.NaN;

      if (Number.isFinite(expiresInValue) && expiresInValue > 0) {
        expiresInMs = expiresInValue * 1000;
      }
    }
  } catch {
    token = body.trim();
  }

  if (!token) {
    token = body.trim();
  }

  if (!token || token.length < 10) {
    throw new EPIASError(
      "EPIAS returned an invalid TGT response.",
      "invalid_response"
    );
  }

  tgtCache = {
    token,
    expiresAt: Date.now() + expiresInMs,
  };

  return token;
}

async function epiasGet(url: string): Promise<unknown> {
  async function executeRequest(tgt: string) {
    try {
      return await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          TGT: tgt,
        },
        cache: "no-store",
      });
    } catch (error) {
      throw new EPIASError(
        error instanceof Error
          ? `EPIAS network request failed: ${error.message}`
          : "EPIAS network request failed.",
        "network"
      );
    }
  }

  const tgt = await getTGT();
  const response = await executeRequest(tgt);

  if (response.status === 401) {
    tgtCache = null;

    const freshTgt = await getTGT();
    const retryResponse = await executeRequest(freshTgt);

    if (!retryResponse.ok) {
      throw new EPIASError(
        `EPIAS request failed after TGT refresh: ${retryResponse.status}.`,
        "auth",
        retryResponse.status
      );
    }

    return parseJsonResponse(retryResponse, "retry response");
  }

  if (!response.ok) {
    throw new EPIASError(
      `EPIAS request failed with status ${response.status}.`,
      getHttpErrorCode(response.status),
      response.status
    );
  }

  return parseJsonResponse(response, "response");
}

/**
 * Fetches day-ahead PTF and SMF data from EPIAS.
 * The transparency service expects all date filters in Turkey time (+03:00).
 */
export async function fetchDayAheadMCP(
  startDate: string,
  endDate: string
): Promise<EPIASPricePoint[]> {
  const dayCount = getInclusiveDayCount(startDate, endDate);
  const url = buildEpiasUrl("/markets/dam/data/mcp-smf-price-summary", {
    startDate: buildTurkeyDateTime(startDate, "start"),
    endDate: buildTurkeyDateTime(endDate, "end"),
  });

  try {
    const payload = await epiasGet(url);

    return normalizePriceItems(ensureItemsArray(payload, "day-ahead MCP/SMF"), {
      label: "marketTradePrice",
      priceFields: ["marketTradePrice", "mcp", "price"],
      smfFields: ["systemMarginalPrice", "smp", "smf"],
      dateFields: ["date"],
    });
  } catch (error) {
    if (error instanceof EPIASError && error.code === "auth") {
      console.warn(
        "[EP\u0130A\u015E] Auth credentials eksik \u2014 mock data kullan\u0131l\u0131yor"
      );
      return generateMockPrices(dayCount);
    }

    throw error;
  }
}

/**
 * Fetches intraday market clearing prices (GIP MCP) from EPIAS.
 * The transparency service expects all date filters in Turkey time (+03:00).
 */
export async function fetchIntradayMCP(
  startDate: string,
  endDate: string
): Promise<EPIASPricePoint[]> {
  const url = buildEpiasUrl("/markets/idm/data/mcp", {
    startDate: buildTurkeyDateTime(startDate, "start"),
    endDate: buildTurkeyDateTime(endDate, "end"),
  });
  const payload = await epiasGet(url);

  return normalizePriceItems(ensureItemsArray(payload, "intraday MCP"), {
    label: "intraday MCP",
    priceFields: ["marketTradePrice", "mcp", "price", "weightedAveragePrice"],
    smfFields: ["systemMarginalPrice", "smp", "smf"],
    dateFields: ["date"],
  });
}

/**
 * Fetches the daily system direction from EPIAS.
 * Returns "long" for surplus, "short" for deficit, and "balanced" otherwise.
 */
export async function fetchSystemDirection(
  date: string
): Promise<SystemDirection> {
  const dateKey = normalizeRequestDateKey(date, "date");
  const url = buildEpiasUrl("/markets/bpm/data/system-direction", {
    date: buildTurkeyDateTime(dateKey, "start"),
  });
  const payload = await epiasGet(url);
  const items = ensureItemsArray(payload, "system direction");

  if (items.length === 0) {
    throw new EPIASError(
      "EPIAS system direction response is empty.",
      "invalid_response"
    );
  }

  const item = pickSystemDirectionItem(items, dateKey);
  const fieldNames = [
    "systemDirection",
    "direction",
    "systemDirectionCode",
    "directionCode",
    "value",
    "status",
    "sdSign",
  ];

  for (const fieldName of fieldNames) {
    if (item[fieldName] != null && item[fieldName] !== "") {
      return normalizeSystemDirectionValue(item[fieldName]);
    }
  }

  throw new EPIASError(
    "EPIAS system direction response is missing a direction field.",
    "invalid_response"
  );
}

export async function fetchLastNDays(n: number): Promise<EPIASPricePoint[]> {
  const totalDays = Math.max(1, Math.floor(n));
  const endDate = getTurkeyDateKey();
  const startDate = shiftDateKey(endDate, -(totalDays - 1));

  return fetchDayAheadMCP(startDate, endDate);
}

function clampPrice(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildMockDayAheadPrice(
  dayIndex: number,
  hour: number,
  month: number,
  dayOfWeek: number
) {
  const basePrice = 1500;
  const dayOfWeekDelta = dayOfWeek === 0 || dayOfWeek === 6 ? -200 : 100;
  const seasonalDelta = [12, 1, 2].includes(month) ? 300 : 0;
  let hourlyDelta = 0;

  if (hour >= 8 && hour <= 11) {
    hourlyDelta += 400;
  } else if (hour >= 17 && hour <= 21) {
    hourlyDelta += 600;
  } else if (hour >= 2 && hour <= 5) {
    hourlyDelta -= 400;
  }

  const microVariation = Math.sin((dayIndex + 1) * (hour + 1)) * 85;

  return clampPrice(
    basePrice + hourlyDelta + dayOfWeekDelta + seasonalDelta + microVariation,
    800,
    3500
  );
}

/**
 * Generates deterministic mock PTF data for development/testing.
 * Turkish PTF range: 800-3500 TRY/MWh with daily and seasonal patterns.
 */
export function generateMockPrices(days: number): EPIASPricePoint[] {
  const totalDays = Math.max(1, Math.floor(days));
  const endDate = getTurkeyDateKey();
  const startDate = shiftDateKey(endDate, -(totalDays - 1));
  const points: EPIASPricePoint[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const currentDateKey = shiftDateKey(startDate, dayIndex);
    const currentDate = parseDateKey(currentDateKey);
    const dayOfWeek = currentDate.getUTCDay();
    const month = currentDate.getUTCMonth() + 1;

    for (let hour = 0; hour < 24; hour += 1) {
      const ptf = Number(
        buildMockDayAheadPrice(dayIndex, hour, month, dayOfWeek).toFixed(1)
      );
      const smfDelta =
        (hour >= 18 && hour <= 21 ? 140 : hour >= 2 && hour <= 5 ? -120 : 60) +
        Math.cos((dayIndex + 2) * (hour + 1)) * 35;
      const smf = Number(clampPrice(ptf + smfDelta, 700, 3900).toFixed(1));

      points.push({
        date: currentDateKey,
        hour,
        ptf,
        smf,
      });
    }
  }

  return sortPricePoints(points);
}

/**
 * Generates deterministic mock intraday MCP data.
 * GIP prices deviate from day-ahead PTF by roughly 5-15%.
 */
export function generateMockIntradayPrices(days: number): EPIASPricePoint[] {
  const dayAheadPoints = generateMockPrices(days);

  return sortPricePoints(
    dayAheadPoints.map((point, index) => {
      const deviationPct = 0.05 + Math.abs(Math.sin((index + 1) * 1.618)) * 0.1;
      const direction =
        Math.cos((point.hour + 1) * (index % 7 + 1)) >= 0 ? 1 : -1;
      const ptf = Number(
        clampPrice(point.ptf * (1 + direction * deviationPct), 700, 4000).toFixed(1)
      );
      const smf =
        point.smf == null
          ? undefined
          : Number(
              clampPrice(
                point.smf * (1 + direction * Math.max(0.03, deviationPct - 0.02)),
                700,
                4000
              ).toFixed(1)
            );

      return {
        date: point.date,
        hour: point.hour,
        ptf,
        smf,
      };
    })
  );
}
