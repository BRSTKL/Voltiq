"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import {
  ArrowPathIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import SaveCalculationButton from "@/components/SaveCalculationButton";
import {
  ActionButton,
  Badge,
  PanelCard,
  SectionLabel,
} from "@/components/ui";
import useSavedCalculationRestore from "@/hooks/useSavedCalculationRestore";
import {
  calculateHourlyImbalance,
  calculateImbalance,
  type ImbalanceInput,
  type ImbalanceResult,
} from "@/lib/imbalanceCalc";

type SystemDirection = ImbalanceInput["direction"];

type HourlyRow = {
  hour: number;
  scheduled: number;
  actual: number;
  ptf: number;
  smf: number;
};

type HourlySummary = ReturnType<typeof calculateHourlyImbalance>;

type SavedHourlyRow = Partial<HourlyRow> & { hour?: number };

type MarketPricesResponse = {
  prices?: Array<{
    date: string;
    hour: number;
    ptf: number;
    smf?: number;
  }>;
  meta?: {
    isMock?: boolean;
  };
};

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.72)] px-4 text-sm text-[#F8FAFC] outline-none transition focus:border-[rgba(96,165,250,0.65)] focus:ring-2 focus:ring-[rgba(59,130,246,0.28)]";

const TABLE_INPUT_CLASS_NAME =
  "min-h-[38px] w-full rounded-xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.65)] px-3 text-right text-sm text-[#F8FAFC] outline-none transition focus:border-[rgba(96,165,250,0.65)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]";

const DIRECTION_OPTIONS: Array<{
  value: SystemDirection;
  label: string;
}> = [
  { value: "long", label: "Fazlalik (Long)" },
  { value: "short", label: "Eksik (Short)" },
  { value: "balanced", label: "Dengeli" },
];

const RISK_STYLES: Record<
  ImbalanceResult["riskCategory"],
  { label: string; className: string }
> = {
  low: {
    label: "Dusuk Risk",
    className:
      "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)] text-[#10B981]",
  },
  medium: {
    label: "Orta Risk",
    className:
      "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
  },
  high: {
    label: "Yuksek Risk",
    className:
      "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
  },
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSignedValue(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatCurrency(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function getCurrentTurkeyHour() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  });

  return Number(formatter.format(new Date()));
}

function createDefaultHourlyRows(): HourlyRow[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const peakPremium = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21) ? 240 : 0;
    const nightDiscount = hour >= 0 && hour <= 5 ? -130 : 0;
    const basePtf =
      1750 + Math.sin(((hour - 6) / 24) * Math.PI * 2) * 140 + peakPremium + nightDiscount;
    const smfOffset = hour >= 17 && hour <= 21 ? 95 : hour >= 0 && hour <= 5 ? -70 : 25;
    const scheduled = 96 + Math.cos(((hour + 2) / 24) * Math.PI * 2) * 8;
    const actual = scheduled + Math.sin(((hour + 4) / 24) * Math.PI * 4) * 4.5;

    return {
      hour,
      scheduled: round(scheduled, 1),
      actual: round(actual, 1),
      ptf: round(basePtf, 1),
      smf: round(basePtf + smfOffset, 1),
    };
  });
}

function buildInitialSingleInput(rows: HourlyRow[]): ImbalanceInput {
  const hour = getCurrentTurkeyHour();
  const selectedRow = rows.find((row) => row.hour === hour) ?? rows[0];

  return {
    scheduledMWh: selectedRow.scheduled,
    actualMWh: selectedRow.actual,
    ptf: selectedRow.ptf,
    smf: selectedRow.smf,
    direction: "balanced",
  };
}

function getCostTone(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "text-[#E2E8F0]";
  }

  return value >= 0 ? "text-[#10B981]" : "text-[#EF4444]";
}

function parseLocaleNumber(rawValue: string) {
  const normalized = rawValue.trim().replace(/\s+/g, "");

  if (!normalized) {
    return Number.NaN;
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      return Number.parseFloat(normalized.replace(/\./g, "").replace(",", "."));
    }

    return Number.parseFloat(normalized.replace(/,/g, ""));
  }

  if (normalized.includes(",")) {
    return Number.parseFloat(normalized.replace(",", "."));
  }

  return Number.parseFloat(normalized);
}

function buildRowsFromMarketData(
  prices: NonNullable<MarketPricesResponse["prices"]>,
  currentRows: HourlyRow[]
) {
  const priceMap = new Map(prices.map((price) => [price.hour, price]));

  return currentRows.map((row) => {
    const point = priceMap.get(row.hour);

    if (!point) {
      return row;
    }

    return {
      ...row,
      ptf: round(point.ptf, 1),
      smf: round(point.smf ?? point.ptf, 1),
    };
  });
}

function parseHourlyCsv(text: string, currentRows: HourlyRow[]) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("CSV dosyasi bos.");
  }

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const nextRows = currentRows.map((row) => ({ ...row }));
  const dataLines =
    lines.length > 0 && /[A-Za-zCIGOSUcigosu]/.test(lines[0]) ? lines.slice(1) : lines;

  dataLines.forEach((line, index) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());

    if (cells.length < 2) {
      return;
    }

    const firstCellNumber = parseLocaleNumber(cells[0]);
    const hasExplicitHour = Number.isFinite(firstCellNumber);
    const hour = hasExplicitHour
      ? Math.min(23, Math.max(0, Math.round(firstCellNumber)))
      : index;

    if (hour < 0 || hour > 23) {
      return;
    }

    const scheduledValue = parseLocaleNumber(cells[hasExplicitHour ? 1 : 0] ?? "");
    const actualValue = parseLocaleNumber(cells[hasExplicitHour ? 2 : 1] ?? "");
    const ptfValue = parseLocaleNumber(cells[hasExplicitHour ? 3 : 2] ?? "");
    const smfValue = parseLocaleNumber(cells[hasExplicitHour ? 4 : 3] ?? "");

    nextRows[hour] = {
      hour,
      scheduled: Number.isFinite(scheduledValue)
        ? round(scheduledValue, 3)
        : nextRows[hour].scheduled,
      actual: Number.isFinite(actualValue)
        ? round(actualValue, 3)
        : nextRows[hour].actual,
      ptf: Number.isFinite(ptfValue) ? round(ptfValue, 2) : nextRows[hour].ptf,
      smf: Number.isFinite(smfValue) ? round(smfValue, 2) : nextRows[hour].smf,
    };
  });

  return nextRows;
}

function NumberField({
  label,
  value,
  onChange,
  step = "0.1",
  helper,
}: {
  label: string;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  helper?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <input
        type="number"
        step={step}
        value={value}
        onChange={onChange}
        className={INPUT_CLASS_NAME}
      />
      {helper ? (
        <p className="text-xs leading-6 text-[#94A3B8]">{helper}</p>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SystemDirection;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <select value={value} onChange={onChange} className={INPUT_CLASS_NAME}>
        {DIRECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricTile({
  label,
  value,
  helper,
  accentClassName = "text-[#F8FAFC]",
}: {
  label: string;
  value: string;
  helper: string;
  accentClassName?: string;
}) {
  return (
    <div className="rounded-3xl border border-[rgba(148,163,184,0.14)] bg-[rgba(15,23,42,0.72)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${accentClassName}`}>
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-[#94A3B8]">{helper}</p>
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="rounded-3xl border border-dashed border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.36)] px-5 py-8 text-sm leading-7 text-[#94A3B8]">
      Parametreleri girip simulasyonu calistirdiginizda dengesizlik hacmi, bedeli ve saatlik toplam etki burada gorunur.
    </div>
  );
}

export default function ImbalanceSimulator() {
  const defaultRows = createDefaultHourlyRows();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [singleInput, setSingleInput] = useState<ImbalanceInput>(() =>
    buildInitialSingleInput(defaultRows)
  );
  const [hourlyRows, setHourlyRows] = useState<HourlyRow[]>(defaultRows);
  const [singleResult, setSingleResult] = useState<ImbalanceResult | null>(null);
  const [hourlySummary, setHourlySummary] = useState<HourlySummary | null>(null);
  const [error, setError] = useState("");
  const [marketNotice, setMarketNotice] = useState("");
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  const savedInputData = {
    singleInput,
    hourlyRows,
  };
  const savedOutputData = {
    singleResult,
    hourlySummary,
    marketNotice,
  };

  useSavedCalculationRestore(
    "imbalance",
    (savedCalculation) => {
      const nextInputs = savedCalculation.inputData ?? {};
      const nextOutput = savedCalculation.outputData ?? {};

      const restoredRows = Array.isArray(nextInputs.hourlyRows)
        ? nextInputs.hourlyRows.map((row: SavedHourlyRow, index) => ({
            hour: Number(row.hour ?? index),
            scheduled: Number(row.scheduled ?? 0),
            actual: Number(row.actual ?? 0),
            ptf: Number(row.ptf ?? 0),
            smf: Number(row.smf ?? 0),
          }))
        : defaultRows;

      setSingleInput({
        scheduledMWh: Number(
          (nextInputs.singleInput as Partial<ImbalanceInput> | undefined)
            ?.scheduledMWh ?? buildInitialSingleInput(restoredRows).scheduledMWh
        ),
        actualMWh: Number(
          (nextInputs.singleInput as Partial<ImbalanceInput> | undefined)
            ?.actualMWh ?? buildInitialSingleInput(restoredRows).actualMWh
        ),
        ptf: Number(
          (nextInputs.singleInput as Partial<ImbalanceInput> | undefined)
            ?.ptf ?? buildInitialSingleInput(restoredRows).ptf
        ),
        smf: Number(
          (nextInputs.singleInput as Partial<ImbalanceInput> | undefined)
            ?.smf ?? buildInitialSingleInput(restoredRows).smf
        ),
        direction:
          ((nextInputs.singleInput as Partial<ImbalanceInput> | undefined)
            ?.direction as SystemDirection | undefined) ?? "balanced",
      });
      setHourlyRows(restoredRows);
      setSingleResult((nextOutput.singleResult as ImbalanceResult | null) ?? null);
      setHourlySummary((nextOutput.hourlySummary as HourlySummary | null) ?? null);
      setMarketNotice(String(nextOutput.marketNotice ?? ""));
      setError("");
    },
    setError
  );

  function handleSingleInputChange(
    field: keyof ImbalanceInput,
    value: number | SystemDirection
  ) {
    setSingleInput((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleHourlyRowChange(
    hour: number,
    field: keyof Omit<HourlyRow, "hour">,
    value: string
  ) {
    const parsedValue = parseLocaleNumber(value);

    setHourlyRows((currentRows) =>
      currentRows.map((row) =>
        row.hour === hour
          ? {
              ...row,
              [field]: Number.isFinite(parsedValue)
                ? round(parsedValue, field === "scheduled" || field === "actual" ? 3 : 2)
                : 0,
            }
          : row
      )
    );
  }

  async function handleLoadMarketData() {
    setIsMarketLoading(true);
    setError("");

    try {
      const response = await fetch("/api/market/prices?days=1");

      if (!response.ok) {
        throw new Error("PTF/SMF verisi alinamadi.");
      }

      const payload = (await response.json()) as MarketPricesResponse;
      const marketRows = buildRowsFromMarketData(payload.prices ?? [], hourlyRows);
      const turkeyHour = getCurrentTurkeyHour();
      const currentHourRow =
        marketRows.find((row) => row.hour === turkeyHour) ?? marketRows[marketRows.length - 1];

      setHourlyRows(marketRows);
      setSingleInput((current) => ({
        ...current,
        ptf: currentHourRow?.ptf ?? current.ptf,
        smf: currentHourRow?.smf ?? current.smf,
      }));
      setMarketNotice(
        payload.meta?.isMock
          ? "EPİAŞ baglantisi yerine bugun icin simule fiyatlar yuklendi."
          : "Bugunun 24 saatlik PTF ve SMF verileri tabloya aktarildi."
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "PTF/SMF verisi alinamadi."
      );
    } finally {
      setIsMarketLoading(false);
    }
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const nextRows = parseHourlyCsv(text, hourlyRows);
      setHourlyRows(nextRows);
      setMarketNotice(
        "CSV iceri aktarildi. Beklenen format: hour,scheduled,actual,ptf,smf."
      );
      setError("");
    } catch (csvError) {
      setError(
        csvError instanceof Error
          ? csvError.message
          : "CSV dosyasi okunamadi."
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleRunSimulation() {
    try {
      const nextSingleResult = calculateImbalance(singleInput);
      const nextHourlySummary = calculateHourlyImbalance(
        hourlyRows.map((row) => ({
          scheduled: row.scheduled,
          actual: row.actual,
          ptf: row.ptf,
          smf: row.smf,
        })),
        singleInput.direction
      );

      setSingleResult(nextSingleResult);
      setHourlySummary(nextHourlySummary);
      setError("");
    } catch (calculationError) {
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : "Dengesizlik simulasyonu hesaplanamadi."
      );
    }
  }

  const riskStyle = singleResult ? RISK_STYLES[singleResult.riskCategory] : null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <div className="overflow-hidden rounded-[32px] border border-[rgba(59,130,246,0.18)] bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.82),rgba(15,15,26,1)_58%)] p-6 text-[#F8FAFC] shadow-[0_30px_100px_rgba(2,6,23,0.4)] sm:p-8">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge color="blue">Turkiye Enerji Ticareti</Badge>
            <Badge color="amber">PRO Tool</Badge>
            <Badge color="green">PTF / SMF Settlement</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.04em] sm:text-5xl">
            Dengesizlik Bedeli Simülatörü
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#CBD5E1] sm:text-lg">
            GÖP programi ile gerceklesme arasindaki farki saatlik bazda modele edin,
            PTF-SMF etkisini gorun ve long/short sistem yonunde portfoy riskinizi
            hizla test edin.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(127,29,29,0.12)] px-4 py-3 text-sm text-[#FCA5A5]">
          {error}
        </div>
      ) : null}

      {marketNotice ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(59,130,246,0.26)] bg-[rgba(30,64,175,0.12)] px-4 py-2 text-sm font-medium text-[#BFDBFE]">
          <ArrowPathIcon className="h-4 w-4" />
          <span>{marketNotice}</span>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PanelCard className="space-y-6 rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[#0F172A] p-6 text-[#F8FAFC] shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <SectionLabel>Ana Senaryo</SectionLabel>
              <div className="text-xs text-[#94A3B8]">
                Pozitif dengesizlik = fazla, negatif dengesizlik = eksik
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Programlanmis enerji (MWh)"
                value={singleInput.scheduledMWh}
                onChange={(event) =>
                  handleSingleInputChange(
                    "scheduledMWh",
                    Number(event.target.value)
                  )
                }
              />
              <NumberField
                label="Gerceklesen enerji (MWh)"
                value={singleInput.actualMWh}
                onChange={(event) =>
                  handleSingleInputChange("actualMWh", Number(event.target.value))
                }
              />
              <NumberField
                label="PTF (TL/MWh)"
                value={singleInput.ptf}
                onChange={(event) =>
                  handleSingleInputChange("ptf", Number(event.target.value))
                }
                helper="Manuel girebilir veya bugunun market fiyatlarini tabloya cekebilirsiniz."
              />
              <NumberField
                label="SMF (TL/MWh)"
                value={singleInput.smf}
                onChange={(event) =>
                  handleSingleInputChange("smf", Number(event.target.value))
                }
              />
            </div>

            <SelectField
              label="Sistem yonu"
              value={singleInput.direction}
              onChange={(event) =>
                handleSingleInputChange(
                  "direction",
                  event.target.value as SystemDirection
                )
              }
            />
          </div>

          <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.78)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleLoadMarketData()}
                disabled={isMarketLoading}
                className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.8)] px-4 py-2.5 text-sm font-semibold text-[#E2E8F0] transition hover:border-[rgba(96,165,250,0.5)] hover:text-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${isMarketLoading ? "animate-spin" : ""}`}
                />
                <span>
                  {isMarketLoading ? "Yukleniyor..." : "API'dan PTF / SMF cek"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.8)] px-4 py-2.5 text-sm font-semibold text-[#E2E8F0] transition hover:border-[rgba(96,165,250,0.5)] hover:text-[#F8FAFC]"
              >
                <DocumentArrowUpIcon className="h-4 w-4" />
                <span>CSV iceri aktar</span>
              </button>
            </div>
            <p className="mt-3 text-xs leading-6 text-[#94A3B8]">
              CSV format ornegi: <code>hour,scheduled,actual,ptf,smf</code>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvImport}
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleRunSimulation} usageGuarded variant="primary">
              Simulasyonu Hesapla
            </ActionButton>
            <p className="text-sm leading-6 text-[#94A3B8]">
              Sistem yonu ile ayni taraftaki sapmalar icin %10 ek ceza varsayimi
              kullanilir.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          {singleResult && hourlySummary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Dengesizlik Hacmi"
                  value={`${formatSignedValue(singleResult.imbalanceVolume, 3)} MWh`}
                  helper="Pozitif deger fazla pozisyonu, negatif deger eksik pozisyonu gosterir."
                  accentClassName={
                    singleResult.imbalanceVolume >= 0
                      ? "text-[#10B981]"
                      : "text-[#EF4444]"
                  }
                />
                <MetricTile
                  label="Dengesizlik Bedeli"
                  value={formatCurrency(singleResult.imbalanceCost, 2)}
                  helper="Pozitif deger kazanci, negatif deger maliyeti temsil eder."
                  accentClassName={getCostTone(singleResult.imbalanceCost)}
                />
                <MetricTile
                  label="Efektif Fiyat"
                  value={`${formatNumber(singleResult.effectivePrice, 2)} TL/MWh`}
                  helper="Dengesizlik hacminin settle edildigi efektif birim fiyat."
                />
                <MetricTile
                  label="PTF - SMF Spread"
                  value={`${formatSignedValue(singleResult.ptfSmfSpread, 2)} TL/MWh`}
                  helper="Spread arttikca ceza etkisi ve volatilite riski buyur."
                  accentClassName={
                    singleResult.ptfSmfSpread >= 0
                      ? "text-[#FBBF24]"
                      : "text-[#93C5FD]"
                  }
                />
              </div>

              <PanelCard className="rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[#0F172A] p-6 text-[#F8FAFC] shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <SectionLabel>Risk Değerlendirmesi</SectionLabel>
                    <div className="mt-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${riskStyle?.className ?? ""}`}
                      >
                        {riskStyle?.label}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.78)] px-4 py-3 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                      Gunluk Toplam Etki
                    </p>
                    <p className={`mt-2 text-2xl font-semibold ${getCostTone(hourlySummary.totalCost)}`}>
                      {formatCurrency(hourlySummary.totalCost, 2)}
                    </p>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      Toplam hacim {formatSignedValue(hourlySummary.totalVolume, 3)} MWh
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-7 text-[#CBD5E1]">
                  {singleResult.explanation}
                </p>
              </PanelCard>
            </>
          ) : (
            <EmptyResults />
          )}
        </div>
      </div>

      <PanelCard className="mt-6 rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[#0F172A] p-6 text-[#F8FAFC] shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionLabel>Saatlik Simulasyon</SectionLabel>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              24 Saatlik Dengesizlik Tablosu
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
              Her saat icin program, gerceklesme, PTF ve SMF girerek gunluk maliyet veya
              kazanci hesaplayin.
            </p>
          </div>

          {hourlySummary ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.72)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Toplam Bedel
                </p>
                <p className={`mt-2 text-xl font-semibold ${getCostTone(hourlySummary.totalCost)}`}>
                  {formatCurrency(hourlySummary.totalCost, 2)}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(15,23,42,0.72)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Toplam Hacim
                </p>
                <p className="mt-2 text-xl font-semibold text-[#E2E8F0]">
                  {formatSignedValue(hourlySummary.totalVolume, 3)} MWh
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                <th className="px-3 py-2">Saat</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Gerceklesen</th>
                <th className="px-3 py-2">PTF</th>
                <th className="px-3 py-2">SMF</th>
                <th className="px-3 py-2">Dengesizlik</th>
                <th className="px-3 py-2">Bedel</th>
              </tr>
            </thead>
            <tbody>
              {hourlyRows.map((row, index) => {
                const hourlyResult = hourlySummary?.results[index] ?? null;

                return (
                  <tr key={row.hour} className="rounded-2xl bg-[rgba(15,23,42,0.52)]">
                    <td className="rounded-l-2xl px-3 py-2 font-mono text-sm text-[#CBD5E1]">
                      {String(row.hour).padStart(2, "0")}:00
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.scheduled}
                        onChange={(event) =>
                          handleHourlyRowChange(row.hour, "scheduled", event.target.value)
                        }
                        className={TABLE_INPUT_CLASS_NAME}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.actual}
                        onChange={(event) =>
                          handleHourlyRowChange(row.hour, "actual", event.target.value)
                        }
                        className={TABLE_INPUT_CLASS_NAME}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.ptf}
                        onChange={(event) =>
                          handleHourlyRowChange(row.hour, "ptf", event.target.value)
                        }
                        className={TABLE_INPUT_CLASS_NAME}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.smf}
                        onChange={(event) =>
                          handleHourlyRowChange(row.hour, "smf", event.target.value)
                        }
                        className={TABLE_INPUT_CLASS_NAME}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-sm text-[#E2E8F0]">
                      {hourlyResult
                        ? `${formatSignedValue(hourlyResult.imbalanceVolume, 3)} MWh`
                        : "--"}
                    </td>
                    <td
                      className={`rounded-r-2xl px-3 py-2 font-mono text-sm font-semibold ${
                        hourlyResult ? getCostTone(hourlyResult.imbalanceCost) : "text-[#E2E8F0]"
                      }`}
                    >
                      {hourlyResult
                        ? formatCurrency(hourlyResult.imbalanceCost, 2)
                        : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-[rgba(148,163,184,0.12)] pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 rounded-2xl border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[#FDE68A]">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
            <p className="leading-6">
              Ayni saat verileriyle calisan portfoylerde sistem yonu ve PTF-SMF spreadi toplam
              dengesizlik maliyetini hizla buyutebilir.
            </p>
          </div>

          {singleResult && hourlySummary ? (
            <div className="w-full lg:max-w-sm">
              <SaveCalculationButton
                toolSlug="imbalance"
                inputData={savedInputData}
                outputData={savedOutputData}
              />
            </div>
          ) : null}
        </div>
      </PanelCard>
    </section>
  );
}
