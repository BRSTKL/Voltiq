import { useState } from "react";
import {
  ActionButton,
  ExportButton,
  MetricCard,
  PanelCard,
  ProjectReportCta,
  SectionLabel,
  SliderField,
} from "../ui";
import {
  REPORT_STORAGE_KEYS,
  createToolReportSnapshot,
  saveToolReportResult,
} from "../../lib/reportStorage";
import { calculateBatterySizing } from "../../lib/batteryCalc";

const EMPTY_RESULTS = {
  nightLoad: null,
  usableCapacity: null,
  nominalCapacity: null,
  batteryCount: null,
  dod: null,
  cycleLife: "",
};

const BATTERY_LABELS = {
  lfp: "LFP",
  nmc: "NMC",
  lead: "Lead Acid (AGM)",
};

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 1 : 0,
  }).format(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightTokens(results, voltage) {
  const values = [
    results.usableCapacity,
    results.nominalCapacity,
    results.batteryCount,
    results.dod ? results.dod * 100 : null,
    voltage,
  ].filter((value) => value !== null && value !== undefined && Number.isFinite(value));

  const tokens = new Set();

  values.forEach((value) => {
    [0, 1, 2].forEach((digits) => {
      const fixed = value.toFixed(digits);
      const normalized = Number(fixed).toString();
      const localized = Number(fixed).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

      tokens.add(fixed);
      tokens.add(normalized);
      tokens.add(localized);
    });
  });

  if (results.dod) {
    const dodPercentage = Number((results.dod * 100).toFixed(0));
    tokens.add(`${dodPercentage}%`);
  }

  tokens.add(`${voltage}V`);

  return Array.from(tokens)
    .filter((token) => token && token !== "0" && token !== "0.0")
    .sort((first, second) => second.length - first.length);
}

function renderAnalysisWithHighlights(text, results, voltage) {
  if (!text) {
    return null;
  }

  const tokens = buildHighlightTokens(results, voltage);

  if (!tokens.length) {
    return text;
  }

  const matcher = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "g");
  const tokenSet = new Set(tokens);

  return text.split(matcher).map((part, index) =>
    tokenSet.has(part) ? <strong key={`${part}-${index}`}>{part}</strong> : part
  );
}

function buildBatterySummary({ consumption, nightRatio, autonomy, battType, voltage, results }) {
  const batteryLabel = BATTERY_LABELS[battType] ?? battType;
  const dodPercentage = Math.round(results.dod * 100);
  const nightLoad = Number(results.nightLoad.toFixed(1));
  const usableCapacity = Number(results.usableCapacity.toFixed(1));
  const nominalCapacity = Number(results.nominalCapacity.toFixed(1));

  const suitabilityNote =
    battType === "lfp"
      ? "LFP is well suited to frequent cycling and daily residential or commercial dispatch."
      : battType === "nmc"
        ? "NMC provides compact energy density, but thermal management and cycle-depth control matter more."
        : "Lead Acid (AGM) is usually the most constrained option for cycle-heavy use because of its lower usable DoD and shorter life.";

  const sizingNote =
    results.batteryCount > 4
      ? `The design requires ${results.batteryCount} parallel or series-connected 100Ah units at ${voltage}V, so balance-of-system design will be a key part of installation quality.`
      : `The design fits within ${results.batteryCount} x 100Ah units at ${voltage}V, which keeps the wiring layout relatively straightforward.`;

  const recommendation =
    battType === "lead"
      ? "Optimization recommendation: consider migrating to LFP if daily cycling is expected, because the same duty profile will reduce maintenance and replacement frequency."
      : results.batteryCount > 4
        ? "Optimization recommendation: standardize on a higher DC bus voltage or larger module blocks to reduce string count and simplify protection design."
        : "Optimization recommendation: validate inverter surge demand and real overnight load diversity before locking the final battery count.";

  return [
    `${batteryLabel} storage sized for ${consumption.toFixed(1)} kWh/day with a ${nightRatio}% night-load share and ${autonomy.toFixed(1)} days of autonomy results in ${usableCapacity} kWh of recommended usable capacity and ${nominalCapacity} kWh nominal installed capacity.`,
    `At ${dodPercentage}% DoD, the expected cycle-life band is ${results.cycleLife}, and the system must reliably carry approximately ${nightLoad} kWh of overnight demand.`,
    `${sizingNote} ${suitabilityNote}`,
    recommendation,
  ].join(" ");
}

function buildBatteryPdfData({
  consumption,
  nightRatio,
  autonomy,
  battType,
  voltage,
  results,
  summary,
}) {
  return {
    inputs: {
      dailyConsumption: `${consumption.toFixed(1)} kWh/day`,
      nightRatio: `${nightRatio}%`,
      autonomyDays: `${autonomy.toFixed(1)} days`,
      batteryType: BATTERY_LABELS[battType] ?? battType,
      systemVoltage: `${voltage}V`,
    },
    metrics: [
      { label: "Recommended Capacity", value: formatNumber(results.usableCapacity, 1), unit: "kWh" },
      { label: "Nominal Capacity", value: formatNumber(results.nominalCapacity, 1), unit: "kWh" },
      { label: "Battery Count", value: formatNumber(results.batteryCount, 0), unit: "units (100Ah)" },
      { label: "Depth of Discharge", value: formatNumber(results.dod * 100, 0), unit: "%" },
    ],
    monthlyData: null,
    aiAnalysis: summary,
  };
}

export default function BatteryStorageSizer() {
  const [consumption, setConsumption] = useState(10);
  const [nightRatio, setNightRatio] = useState(40);
  const [autonomy, setAutonomy] = useState(1);
  const [solarSize, setSolarSize] = useState(5);
  const [battType, setBattType] = useState("lfp");
  const [voltage, setVoltage] = useState(48);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [pdfData, setPdfData] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const hasResults = results.nominalCapacity !== null;
  const dodPercentage = results.dod ? Math.round(results.dod * 100) : 0;

  async function handleCalculateAndAnalyze() {
    setError("");
    setSummary("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = calculateBatterySizing({
        consumption,
        nightRatio,
        autonomy,
        battType,
        voltage,
      });
      setResults(nextResults);
    } catch (calculationError) {
      setError(calculationError.message || "Battery sizing calculation failed.");
      return;
    }

    const nextSummary = buildBatterySummary({
      consumption,
      nightRatio,
      autonomy,
      battType,
      voltage,
      results: nextResults,
    });

    setSummary(nextSummary);
    const nextPdfData = buildBatteryPdfData({
      consumption,
      nightRatio,
      autonomy,
      battType,
      voltage,
      results: nextResults,
      summary: nextSummary,
    });
    setPdfData(nextPdfData);
    saveToolReportResult(
      REPORT_STORAGE_KEYS.battery,
      createToolReportSnapshot({
        toolName: "Battery Storage Sizer",
        inputs: {
          consumption,
          nightRatio,
          autonomy,
          solarSize,
          battType,
          voltage,
        },
        results: nextResults,
        pdfData: nextPdfData,
        aiAnalysis: nextSummary,
      })
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Battery Storage Sizer
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Size a battery bank for night-time demand, review DoD utilization, and generate a local
          engineering summary.
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <PanelCard className="space-y-6">
          <div className="space-y-5">
            <SliderField
              label="Daily energy consumption"
              min={1}
              max={50}
              step={0.5}
              value={consumption}
              onChange={(event) => setConsumption(Number(event.target.value))}
              displayValue={`${consumption.toFixed(1)} kWh`}
            />
            <SliderField
              label="Night consumption ratio"
              min={10}
              max={90}
              step={5}
              value={nightRatio}
              onChange={(event) => setNightRatio(Number(event.target.value))}
              displayValue={`${nightRatio}%`}
            />
            <SliderField
              label="Autonomy days"
              min={0.5}
              max={5}
              step={0.5}
              value={autonomy}
              onChange={(event) => setAutonomy(Number(event.target.value))}
              displayValue={`${autonomy.toFixed(1)} days`}
            />
            <SliderField
              label="Solar system size"
              min={0}
              max={30}
              step={0.5}
              value={solarSize}
              onChange={(event) => setSolarSize(Number(event.target.value))}
              displayValue={`${solarSize.toFixed(1)} kWp`}
            />

            <label className="flex flex-col gap-2">
              <SectionLabel>Battery technology</SectionLabel>
              <select
                value={battType}
                onChange={(event) => setBattType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="lfp">LFP</option>
                <option value="nmc">NMC</option>
                <option value="lead">Lead Acid (AGM)</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <SectionLabel>System voltage</SectionLabel>
              <select
                value={voltage}
                onChange={(event) => setVoltage(Number(event.target.value))}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value={12}>12V</option>
                <option value={24}>24V</option>
                <option value={48}>48V</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculateAndAnalyze} variant="primary">
              Calculate
            </ActionButton>
            <p className="text-sm text-[var(--color-text-muted)]">
              Solar system size is shown for context only in this iteration and does not change the
              battery formulas.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Recommended capacity"
              value={hasResults ? formatNumber(results.usableCapacity, 1) : "--"}
              unit="kWh"
              accent
            />
            <MetricCard
              label="Nominal capacity"
              value={hasResults ? formatNumber(results.nominalCapacity, 1) : "--"}
              unit="kWh"
            />
            <MetricCard
              label="Battery count"
              value={hasResults ? formatNumber(results.batteryCount, 0) : "--"}
              unit="100Ah units"
            />
            <MetricCard
              label="DoD percentage"
              value={hasResults ? formatNumber(dodPercentage, 0) : "--"}
              unit="%"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>DoD utilization</SectionLabel>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
                <span>Usable {hasResults ? `${formatNumber(results.usableCapacity, 1)} kWh` : "--"}</span>
                <span>Total {hasResults ? `${formatNumber(results.nominalCapacity, 1)} kWh` : "--"}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[var(--color-overlay-subtle)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${dodPercentage}%`, backgroundColor: "#B5D4F4" }}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
                <span>{hasResults ? `${dodPercentage}% usable window` : "Waiting for calculation"}</span>
                <span>{hasResults ? results.cycleLife : "--"}</span>
              </div>
            </div>
            {hasResults && results.batteryCount > 4 ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--badge-amber-bg)] px-3 py-2 text-sm font-medium text-[var(--badge-amber-text)]">
                Series/parallel wiring configuration required
              </p>
            ) : null}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Engineering summary</SectionLabel>
            {summary ? (
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                {renderAnalysisWithHighlights(summary, results, voltage)}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate the system to get a summary
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Battery Storage Sizer"
            data={pdfData}
            disabled={!hasResults || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
