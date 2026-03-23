import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ActionButton,
  Badge,
  ExportButton,
  PanelCard,
  ProjectReportCta,
  SectionLabel,
  SliderField,
} from "../ui";
import { callGemini } from "../../lib/gemini";
import {
  REPORT_STORAGE_KEYS,
  createToolReportSnapshot,
  saveToolReportResult,
} from "../../lib/reportStorage";
import {
  EMISSION_FACTORS,
  calcIntensityMetrics,
  calcLocationBased,
  calcMarketBased,
  calcOffsetCost,
  calcRECoverage,
  checkSBTiAlignment,
} from "../../lib/scope2Calc";

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip
);

const COUNTRIES = Object.keys(EMISSION_FACTORS).sort((left, right) => left.localeCompare(right));
const REPORTING_YEARS = ["2022", "2023", "2024", "2025"];
const BASE_YEARS = ["2019", "2020", "2021"];
const BREAKDOWN_KEYS = ["operations", "manufacturing", "dataCenters", "offices"];
const BREAKDOWN_LABELS = {
  operations: "Operations",
  manufacturing: "Manufacturing",
  dataCenters: "Data centers",
  offices: "Offices",
};

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]";

const INSTRUMENT_META = {
  rec: { label: "RECs / GOs", color: "#1D9E75", background: "#E1F5EE" },
  ppa: { label: "PPA", color: "#378ADD", background: "#E6F1FB" },
  green: { label: "Green tariff", color: "#7F77DD", background: "#EEEDFE" },
  uncovered: { label: "Uncovered", color: "#888780", background: "#F4F4F2" },
};

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "66%",
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${context.label}: ${formatNumber(Number(context.parsed || 0), 0)} MWh`;
        },
      },
    },
  },
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function formatSmartMwh(value) {
  return Number.isFinite(Number(value)) ? `${formatNumber(Number(value), 0)} MWh` : "--";
}

function formatTco2(value, maximumFractionDigits = 1) {
  return Number.isFinite(Number(value)) ? formatNumber(Number(value), maximumFractionDigits) : "--";
}

function formatCurrency(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function normalizeInstrumentState(state, totalConsumptionMwh) {
  const safeTotal = Math.max(0, Number(totalConsumptionMwh) || 0);
  const recMwh = Math.min(Math.max(0, Number(state.recMwh) || 0), safeTotal);
  const ppaMwh = Math.min(Math.max(0, Number(state.ppaMwh) || 0), Math.max(0, safeTotal - recMwh));
  const greenTariffMwh = Math.min(
    Math.max(0, Number(state.greenTariffMwh) || 0),
    Math.max(0, safeTotal - recMwh - ppaMwh)
  );

  return { recMwh, ppaMwh, greenTariffMwh };
}

function clampInstrumentValue(nextValue, otherTotal, totalConsumptionMwh) {
  const safeTotal = Math.max(0, Number(totalConsumptionMwh) || 0);
  return Math.min(Math.max(0, Number(nextValue) || 0), Math.max(0, safeTotal - otherTotal));
}

function rebalanceBreakdown(changedKey, nextValue, currentBreakdown) {
  const safeValue = Math.max(0, Math.min(100, Number(nextValue) || 0));
  const nextBreakdown = { ...currentBreakdown, [changedKey]: Math.round(safeValue) };
  const otherKeys = BREAKDOWN_KEYS.filter((key) => key !== changedKey);
  const remaining = 100 - nextBreakdown[changedKey];
  const currentOtherTotal = otherKeys.reduce((sum, key) => sum + Number(currentBreakdown[key] || 0), 0);

  if (currentOtherTotal <= 0) {
    const evenValue = Math.floor(remaining / otherKeys.length);
    let assigned = 0;

    otherKeys.forEach((key, index) => {
      const value = index === otherKeys.length - 1 ? remaining - assigned : evenValue;
      nextBreakdown[key] = value;
      assigned += value;
    });

    return nextBreakdown;
  }

  const scaledValues = otherKeys.map((key) => ({
    key,
    value: Math.round((Number(currentBreakdown[key] || 0) / currentOtherTotal) * remaining),
  }));
  let diff = remaining - scaledValues.reduce((sum, item) => sum + item.value, 0);

  for (let index = 0; diff !== 0 && index < scaledValues.length * 4; index += 1) {
    const item = scaledValues[index % scaledValues.length];

    if (diff > 0) {
      item.value += 1;
      diff -= 1;
      continue;
    }

    if (item.value > 0) {
      item.value -= 1;
      diff += 1;
    }
  }

  scaledValues.forEach((item) => {
    nextBreakdown[item.key] = item.value;
  });

  return nextBreakdown;
}

function getWeightedResidualFactor(rows) {
  const totalConsumptionMwh = rows.reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0);

  if (!totalConsumptionMwh) {
    return 0;
  }

  const residualBaseline = rows.reduce((sum, row) => {
    const factors = EMISSION_FACTORS[row.country] || { location: 0.475, residualMix: 0.55 };
    return sum + Math.max(0, Number(row.consumptionMwh) || 0) * factors.residualMix;
  }, 0);

  return residualBaseline / totalConsumptionMwh;
}

function buildCountrySummary(rows) {
  return rows.map((row) => `${row.country} ${formatNumber(row.consumptionMwh, 0)} MWh`).join(", ");
}

function getMethodDifferenceText(locationBased, marketBased, reCoverage) {
  if (marketBased < locationBased && reCoverage > 0) {
    return "Market-based is lower because of your RE certificates / PPA coverage.";
  }

  if (marketBased > locationBased) {
    return "Market-based is higher because the residual mix is more carbon intensive than the grid average.";
  }

  return "No contractual instruments currently change reported Scope 2 emissions materially.";
}

function buildScope2Scenario(params) {
  const activeRows = params.multiCountry
    ? params.countryRows
        .map((row) => ({
          ...row,
          consumptionMwh: Math.max(0, Number(row.consumptionMwh) || 0),
        }))
        .filter((row) => row.consumptionMwh > 0)
    : [
        {
          id: "single",
          country: params.country,
          consumptionMwh: Math.max(0, Number(params.annualConsumptionMwh) || 0),
        },
      ];
  const totalConsumptionMwh = activeRows.reduce((sum, row) => sum + row.consumptionMwh, 0);

  if (!params.companyName.trim()) {
    throw new Error("Company name is required for Scope 2 reporting.");
  }

  if (!totalConsumptionMwh) {
    throw new Error("Total electricity consumption must be greater than zero.");
  }

  const locationBased = activeRows.reduce(
    (sum, row) => sum + calcLocationBased(row.consumptionMwh, row.country),
    0
  );
  const weightedLocationFactor = locationBased / totalConsumptionMwh;
  const weightedResidualFactor = getWeightedResidualFactor(activeRows);
  const residualBaseline = totalConsumptionMwh * weightedResidualFactor;
  const marketBased = params.multiCountry
    ? Math.max(0, totalConsumptionMwh - params.recMwh - params.ppaMwh - params.greenTariffMwh) *
        weightedResidualFactor +
      params.ppaMwh * params.ppaEmissionFactor
    : calcMarketBased({
        totalConsumptionMwh,
        country: params.country,
        recMwh: params.recMwh,
        ppaMwh: params.ppaMwh,
        greenTariffMwh: params.greenTariffMwh,
        ppaEmissionFactor: params.ppaEmissionFactor,
      });
  const reCoverage = calcRECoverage(
    totalConsumptionMwh,
    params.recMwh,
    params.ppaMwh,
    params.greenTariffMwh
  );
  const recReduction = params.recMwh * weightedResidualFactor;
  const ppaReduction = params.ppaMwh * (weightedResidualFactor - params.ppaEmissionFactor);
  const greenReduction = params.greenTariffMwh * weightedResidualFactor;
  const uncoveredMwh = Math.max(
    0,
    totalConsumptionMwh - params.recMwh - params.ppaMwh - params.greenTariffMwh
  );
  const offsetCost = calcOffsetCost(marketBased, 65);
  const intensityMetrics = calcIntensityMetrics(marketBased, {
    revenue: params.revenueMillion ? params.revenueMillion * 1000000 : 0,
    employees: params.employees,
    floorAreaM2: params.floorAreaM2,
    productionUnits: 0,
  });
  const sbti =
    Number(params.baseYearTco2) > 0
      ? checkSBTiAlignment(
          marketBased,
          Number(params.baseYearTco2),
          Number(params.reportingYear),
          Number(params.baseYear)
        )
      : null;
  const afterRec = residualBaseline - recReduction;
  const afterPpa = afterRec - ppaReduction;
  const finalAfterAdjustments = afterPpa - greenReduction;

  return {
    companyName: params.companyName.trim(),
    reportingYear: params.reportingYear,
    singleCountry: !params.multiCountry,
    country: params.country,
    countryRows: activeRows,
    countrySummary: buildCountrySummary(activeRows),
    countryLabel: params.multiCountry ? `${activeRows.length}-country portfolio` : params.country,
    totalConsumptionMwh,
    locationBased,
    marketBased,
    weightedLocationFactor,
    weightedResidualFactor,
    reCoverage,
    recMwh: params.recMwh,
    ppaMwh: params.ppaMwh,
    greenTariffMwh: params.greenTariffMwh,
    ppaEmissionFactor: params.ppaEmissionFactor,
    residualBaseline,
    recReduction,
    ppaReduction,
    greenReduction,
    uncoveredMwh,
    offsetCost,
    intensityMetrics,
    revenueMillion: params.revenueMillion,
    employees: params.employees,
    floorAreaM2: params.floorAreaM2,
    baseYear: params.baseYear,
    baseYearTco2: Number(params.baseYearTco2) || 0,
    sbti,
    waterfallLabels: [
      "Residual baseline",
      "REC reduction",
      "PPA adjustment",
      "Green tariff reduction",
      "Market-based Scope 2",
    ],
    waterfallSeries: [
      [0, residualBaseline],
      [Math.min(afterRec, residualBaseline), Math.max(afterRec, residualBaseline)],
      [Math.min(afterPpa, afterRec), Math.max(afterPpa, afterRec)],
      [
        Math.min(finalAfterAdjustments, afterPpa),
        Math.max(finalAfterAdjustments, afterPpa),
      ],
      [0, marketBased],
    ],
    waterfallValues: [
      Number(residualBaseline.toFixed(3)),
      Number((-recReduction).toFixed(3)),
      Number((-ppaReduction).toFixed(3)),
      Number((-greenReduction).toFixed(3)),
      Number(marketBased.toFixed(3)),
    ],
    coverageBreakdown: {
      rec: params.recMwh,
      ppa: params.ppaMwh,
      green: params.greenTariffMwh,
      uncovered: uncoveredMwh,
    },
  };
}

function buildScope2Prompt(results) {
  const locationLine = results.singleCountry
    ? `Country: ${results.country}`
    : `Country portfolio: ${results.countrySummary}`;
  const factorLine = results.singleCountry
    ? `  (grid factor: ${results.weightedLocationFactor.toFixed(3)} kgCO2e/kWh)`
    : `  (weighted grid factor: ${results.weightedLocationFactor.toFixed(3)} kgCO2e/kWh)`;
  const residualLine = results.singleCountry
    ? `  (residual mix: ${results.weightedResidualFactor.toFixed(3)} kgCO2e/kWh)`
    : `  (weighted residual mix: ${results.weightedResidualFactor.toFixed(3)} kgCO2e/kWh)`;
  const baseYearLine = results.baseYearTco2
    ? `Base year (${results.baseYear}): ${formatNumber(results.baseYearTco2, 1)} tCO2e`
    : "";
  const sbtiLine = results.sbti
    ? `SBTi status: ${results.sbti.onTrack ? "On track" : `Behind by ${formatNumber(results.sbti.gap, 0)} tCO2e`}`
    : "";

  return `Analyze this corporate Scope 2 GHG emissions report:
Company: ${results.companyName} (${results.reportingYear})
${locationLine}
Total electricity: ${formatNumber(results.totalConsumptionMwh, 0)} MWh/year
Location-based Scope 2: ${formatNumber(results.locationBased, 1)} tCO2e
${factorLine}
Market-based Scope 2: ${formatNumber(results.marketBased, 1)} tCO2e
${residualLine}
RE coverage: ${formatNumber(results.reCoverage, 1)}%
Instruments: RECs=${formatNumber(results.recMwh, 0)}MWh, PPA=${formatNumber(results.ppaMwh, 0)}MWh,
  Green tariff=${formatNumber(results.greenTariffMwh, 0)}MWh
${baseYearLine}
${sbtiLine}

Provide 4-5 sentences covering:
1. Scope 2 assessment: is this high/low for the sector?
2. Effectiveness of current RE instruments
3. Most impactful action to reduce market-based emissions
4. Regulatory compliance status (CSRD, CDP if applicable)
5. Recommended next step (PPA, additional RECs, or onsite RE)`;
}

function buildScope2PdfData(results, aiAnalysis) {
  return {
    headerSubtitle: results.companyName,
    inputs: {
      Company: results.companyName,
      "Reporting year": results.reportingYear,
      ...(results.singleCountry
        ? { Country: results.country }
        : { "Country portfolio": results.countrySummary }),
      "Total electricity": `${formatNumber(results.totalConsumptionMwh, 0)} MWh`,
      RECs: `${formatNumber(results.recMwh, 0)} MWh`,
      PPA: `${formatNumber(results.ppaMwh, 0)} MWh`,
      "PPA emission factor": `${results.ppaEmissionFactor.toFixed(3)} kgCO2e/kWh`,
      "Green tariff": `${formatNumber(results.greenTariffMwh, 0)} MWh`,
      ...(results.revenueMillion > 0 ? { "Revenue ($M)": formatNumber(results.revenueMillion, 1) } : {}),
      ...(results.employees > 0 ? { Employees: formatNumber(results.employees, 0) } : {}),
      ...(results.floorAreaM2 > 0 ? { "Floor area": `${formatNumber(results.floorAreaM2, 0)} m2` } : {}),
      ...(results.baseYearTco2 > 0
        ? {
            "Base year": results.baseYear,
            "Base year emissions": `${formatNumber(results.baseYearTco2, 1)} tCO2e`,
          }
        : {}),
    },
    metrics: [
      { label: "Location-based", value: formatNumber(results.locationBased, 1), unit: "tCO2e" },
      { label: "Market-based", value: formatNumber(results.marketBased, 1), unit: "tCO2e" },
      { label: "RE coverage", value: formatNumber(results.reCoverage, 1), unit: "%" },
      { label: "Offset cost", value: formatNumber(results.offsetCost, 0), unit: "$" },
      ...(results.intensityMetrics.perRevenueMillion !== null
        ? [
            {
              label: "Intensity per $M",
              value: formatNumber(results.intensityMetrics.perRevenueMillion, 2),
              unit: "tCO2e/$M",
            },
          ]
        : []),
    ],
    monthlyData: results.waterfallValues,
    monthlyLabels: results.waterfallLabels,
    aiAnalysis,
  };
}

function TextField({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={INPUT_CLASS_NAME}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <select value={value} onChange={onChange} className={INPUT_CLASS_NAME}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange, min = "0", max, step = "1", helper = "" }) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <input
        type="number"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        className={INPUT_CLASS_NAME}
      />
      {helper ? <p className="text-xs leading-5 text-[var(--color-text-muted)]">{helper}</p> : null}
    </label>
  );
}

function LoadingIndicator({ message }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
      />
      <span>{message}</span>
    </div>
  );
}

function ScopeMetricCard({ label, value, unit = "", helper = "", accentStyle = null }) {
  const hasAccent = Boolean(accentStyle);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-5",
        !hasAccent &&
          "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]"
      )}
      style={
        hasAccent
          ? {
              backgroundColor: accentStyle.bg,
              border: `1px solid ${accentStyle.color}`,
              color: accentStyle.color,
            }
          : undefined
      }
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.18em]",
          !hasAccent && "text-[var(--color-text-muted)]"
        )}
        style={hasAccent ? { color: accentStyle.color, opacity: 0.8 } : undefined}
      >
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {unit ? (
          <span
            className={cn("pb-1 text-sm font-medium", !hasAccent && "text-[var(--color-text-muted)]")}
            style={hasAccent ? { color: accentStyle.color, opacity: 0.8 } : undefined}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {helper ? (
        <p
          className={cn("mt-3 text-sm leading-6", !hasAccent && "text-[var(--color-text-muted)]")}
          style={hasAccent ? { color: accentStyle.color, opacity: 0.86 } : undefined}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function MethodHeroCard({ label, value, detail, accent = "neutral" }) {
  const accents = {
    neutral: {
      background: "var(--color-surface-secondary)",
      border: "rgba(148,163,184,0.15)",
      color: "var(--color-text)",
      meta: "var(--color-text-muted)",
    },
    green: {
      background: "#E1F5EE",
      border: "#1D9E75",
      color: "#0F6E56",
      meta: "#0F6E56",
    },
    red: {
      background: "#FCEBEB",
      border: "#A32D2D",
      color: "#791F1F",
      meta: "#791F1F",
    },
  };
  const style = accents[accent] || accents.neutral;

  return (
    <div
      className="rounded-[var(--radius-lg)] p-5"
      style={{
        backgroundColor: style.background,
        border: `1px solid ${style.border}`,
        color: style.color,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: style.meta }}>
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight sm:text-4xl">{value}</span>
        <span className="pb-1 text-sm font-medium" style={{ color: style.meta }}>
          tCO2e
        </span>
      </div>
      <p className="mt-3 text-sm leading-6" style={{ color: style.meta }}>
        {detail}
      </p>
    </div>
  );
}

export default function Scope2Calculator() {
  const [companyName, setCompanyName] = useState("");
  const [reportingYear, setReportingYear] = useState("2025");
  const [country, setCountry] = useState("Germany");
  const [multiCountry, setMultiCountry] = useState(false);
  const [countryRows, setCountryRows] = useState([{ id: 1, country: "Germany", consumptionMwh: 1000 }]);
  const [annualConsumptionMwh, setAnnualConsumptionMwh] = useState(1000);
  const [consumptionBreakdown, setConsumptionBreakdown] = useState({
    operations: 25,
    manufacturing: 25,
    dataCenters: 25,
    offices: 25,
  });
  const [recMwh, setRecMwh] = useState(0);
  const [ppaMwh, setPpaMwh] = useState(0);
  const [greenTariffMwh, setGreenTariffMwh] = useState(0);
  const [ppaEmissionFactor, setPpaEmissionFactor] = useState(0.01);
  const [revenueMillion, setRevenueMillion] = useState(0);
  const [employees, setEmployees] = useState(0);
  const [floorAreaM2, setFloorAreaM2] = useState(0);
  const [baseYear, setBaseYear] = useState("2020");
  const [baseYearTco2, setBaseYearTco2] = useState(0);
  const [results, setResults] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [pdfData, setPdfData] = useState(null);

  const totalConsumptionMwh = useMemo(() => {
    if (!multiCountry) {
      return Math.max(0, Number(annualConsumptionMwh) || 0);
    }

    return countryRows.reduce((sum, row) => sum + Math.max(0, Number(row.consumptionMwh) || 0), 0);
  }, [annualConsumptionMwh, countryRows, multiCountry]);

  const hasResults = Boolean(results);
  const marketCardAccent =
    hasResults && results.marketBased <= results.locationBased ? "green" : "red";
  const differenceText = hasResults
    ? getMethodDifferenceText(results.locationBased, results.marketBased, results.reCoverage)
    : "";

  useEffect(() => {
    if (!multiCountry && countryRows.length === 1) {
      setCountryRows((currentRows) =>
        currentRows.map((row) => ({ ...row, country, consumptionMwh: annualConsumptionMwh }))
      );
    }
  }, [annualConsumptionMwh, country, countryRows.length, multiCountry]);

  useEffect(() => {
    const normalized = normalizeInstrumentState({ recMwh, ppaMwh, greenTariffMwh }, totalConsumptionMwh);

    if (
      normalized.recMwh !== recMwh ||
      normalized.ppaMwh !== ppaMwh ||
      normalized.greenTariffMwh !== greenTariffMwh
    ) {
      setRecMwh(normalized.recMwh);
      setPpaMwh(normalized.ppaMwh);
      setGreenTariffMwh(normalized.greenTariffMwh);
    }
  }, [greenTariffMwh, ppaMwh, recMwh, totalConsumptionMwh]);

  const reductionChartData = useMemo(() => {
    if (!hasResults) {
      return null;
    }

    return {
      labels: results.waterfallLabels,
      datasets: [
        {
          label: "Scope 2 calculation flow",
          data: results.waterfallSeries,
          backgroundColor: ["#888780", "#1D9E75", "#1D9E75", "#1D9E75", "#0F6E56"],
          borderWidth: 0,
          borderRadius: 10,
          barThickness: 24,
        },
      ],
    };
  }, [hasResults, results]);

  const reductionChartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw;

              if (!Array.isArray(value)) {
                return ` ${context.label}: ${formatTco2(value, 1)} tCO2e`;
              }

              const delta = Math.abs(Number(value[1]) - Number(value[0]));
              const prefix =
                context.dataIndex === 0
                  ? " Baseline"
                  : context.dataIndex === 4
                    ? " Final market-based"
                    : Number(value[1]) >= Number(value[0])
                      ? " Increase"
                      : " Reduction";

              return `${prefix}: ${formatTco2(delta, 1)} tCO2e`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(148, 163, 184, 0.16)" },
          ticks: {
            color: "rgba(255,255,255,0.72)",
            callback(value) {
              return `${formatNumber(value, 0)} t`;
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.82)" },
        },
      },
    }),
    []
  );

  const donutData = useMemo(() => {
    if (!hasResults) {
      return null;
    }

    return {
      labels: [
        INSTRUMENT_META.rec.label,
        INSTRUMENT_META.ppa.label,
        INSTRUMENT_META.green.label,
        INSTRUMENT_META.uncovered.label,
      ],
      datasets: [
        {
          data: [
            results.coverageBreakdown.rec,
            results.coverageBreakdown.ppa,
            results.coverageBreakdown.green,
            results.coverageBreakdown.uncovered,
          ],
          backgroundColor: [
            INSTRUMENT_META.rec.color,
            INSTRUMENT_META.ppa.color,
            INSTRUMENT_META.green.color,
            INSTRUMENT_META.uncovered.color,
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [hasResults, results]);

  function markDirty() {
    setAiAnalysis("");
    setPdfData(null);
    setError("");
  }

  function handleBreakdownChange(key, nextValue) {
    markDirty();
    setConsumptionBreakdown((current) => rebalanceBreakdown(key, nextValue, current));
  }

  function handleInstrumentChange(key, nextValue) {
    markDirty();

    if (key === "rec") {
      setRecMwh(clampInstrumentValue(nextValue, ppaMwh + greenTariffMwh, totalConsumptionMwh));
      return;
    }

    if (key === "ppa") {
      setPpaMwh(clampInstrumentValue(nextValue, recMwh + greenTariffMwh, totalConsumptionMwh));
      return;
    }

    setGreenTariffMwh(clampInstrumentValue(nextValue, recMwh + ppaMwh, totalConsumptionMwh));
  }

  function addCountryRow() {
    markDirty();
    const usedCountries = new Set(countryRows.map((row) => row.country));
    const nextCountry = COUNTRIES.find((candidate) => !usedCountries.has(candidate)) || COUNTRIES[0];
    setCountryRows((current) => [
      ...current,
      { id: Date.now(), country: nextCountry, consumptionMwh: 0 },
    ]);
  }

  function removeCountryRow(id) {
    if (countryRows.length <= 1) {
      return;
    }

    markDirty();
    setCountryRows((current) => current.filter((row) => row.id !== id));
  }

  function updateCountryRow(id, field, nextValue) {
    markDirty();
    setCountryRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, [field]: field === "consumptionMwh" ? Number(nextValue) : nextValue }
          : row
      )
    );
  }

  async function handleCalculate() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = buildScope2Scenario({
        companyName,
        reportingYear,
        country,
        annualConsumptionMwh,
        multiCountry,
        countryRows,
        recMwh,
        ppaMwh,
        greenTariffMwh,
        ppaEmissionFactor,
        revenueMillion,
        employees,
        floorAreaM2,
        baseYear,
        baseYearTco2,
      });
      setResults(nextResults);
      const nextPdfData = buildScope2PdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.scope2,
        createToolReportSnapshot({
          toolName: "Scope 2 Calculator",
          inputs: {
            companyName,
            reportingYear,
            country,
            annualConsumptionMwh,
            multiCountry,
            countryRows,
            recMwh,
            ppaMwh,
            greenTariffMwh,
            ppaEmissionFactor,
            revenueMillion,
            employees,
            floorAreaM2,
            baseYear,
            baseYearTco2,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Scope 2 calculation failed.");
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildScope2Prompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildScope2PdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.scope2,
        createToolReportSnapshot({
          toolName: "Scope 2 Calculator",
          inputs: {
            companyName,
            reportingYear,
            country,
            annualConsumptionMwh,
            multiCountry,
            countryRows,
            recMwh,
            ppaMwh,
            greenTariffMwh,
            ppaEmissionFactor,
            revenueMillion,
            employees,
            floorAreaM2,
            baseYear,
            baseYearTco2,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildScope2PdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.scope2,
        createToolReportSnapshot({
          toolName: "Scope 2 Calculator",
          inputs: {
            companyName,
            reportingYear,
            country,
            annualConsumptionMwh,
            multiCountry,
            countryRows,
            recMwh,
            ppaMwh,
            greenTariffMwh,
            ppaEmissionFactor,
            revenueMillion,
            employees,
            floorAreaM2,
            baseYear,
            baseYearTco2,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="green">Sustainability</Badge>
          <Badge color="teal">GHG Protocol Scope 2</Badge>
          <Badge color="amber">Pure calculation + Gemini</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Scope 2 Calculator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Corporate Scope 2 GHG accounting for ESG reporting with location-based and market-based
          methods, renewable instrument coverage, and optional SBTi tracking.
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
            <SectionLabel>Organization &amp; reporting</SectionLabel>
            <TextField
              label="Company name"
              value={companyName}
              onChange={(event) => {
                markDirty();
                setCompanyName(event.target.value);
              }}
              placeholder="Example Holdings GmbH"
            />
            <SelectField
              label="Reporting year"
              value={reportingYear}
              onChange={(event) => {
                markDirty();
                setReportingYear(event.target.value);
              }}
              options={REPORTING_YEARS.map((value) => ({ value, label: value }))}
            />
            {!multiCountry ? (
              <SelectField
                label="Country of operations"
                value={country}
                onChange={(event) => {
                  markDirty();
                  setCountry(event.target.value);
                }}
                options={COUNTRIES.map((value) => ({ value, label: value }))}
              />
            ) : null}
            <label className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
              <input
                type="checkbox"
                checked={multiCountry}
                onChange={(event) => {
                  markDirty();
                  setMultiCountry(event.target.checked);
                }}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Multiple countries</p>
                <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                  Enable a country portfolio with per-country MWh rows. RE instruments remain global.
                </p>
              </div>
            </label>
          </div>

          <div className="space-y-5">
            <SectionLabel>Electricity consumption</SectionLabel>

            {multiCountry ? (
              <div className="space-y-3">
                {countryRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto]"
                  >
                    <label className="flex flex-col gap-2">
                      <SectionLabel>Country {index + 1}</SectionLabel>
                      <select
                        value={row.country}
                        onChange={(event) => updateCountryRow(row.id, "country", event.target.value)}
                        className={INPUT_CLASS_NAME}
                      >
                        {COUNTRIES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <NumberField
                      label="Consumption (MWh)"
                      value={row.consumptionMwh}
                      onChange={(event) => updateCountryRow(row.id, "consumptionMwh", event.target.value)}
                      min="0"
                      step="10"
                    />

                    <button
                      type="button"
                      onClick={() => removeCountryRow(row.id)}
                      disabled={countryRows.length <= 1}
                      className="mt-auto min-h-[48px] rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addCountryRow}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)]"
                  >
                    Add country
                  </button>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Portfolio total: {formatSmartMwh(totalConsumptionMwh)}
                  </p>
                </div>
              </div>
            ) : (
              <SliderField
                label="Annual consumption"
                min={10}
                max={1000000}
                step={10}
                value={annualConsumptionMwh}
                onChange={(event) => {
                  markDirty();
                  setAnnualConsumptionMwh(Number(event.target.value));
                }}
                displayValue={formatSmartMwh(annualConsumptionMwh)}
              />
            )}

            <div className="space-y-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    Consumption breakdown
                  </p>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    Optional reporting split. Sliders auto-balance to 100%.
                  </p>
                </div>
                <Badge color="blue">Reporting only</Badge>
              </div>

              {BREAKDOWN_KEYS.map((key) => (
                <SliderField
                  key={key}
                  label={BREAKDOWN_LABELS[key]}
                  min={0}
                  max={100}
                  step={1}
                  value={consumptionBreakdown[key]}
                  onChange={(event) => handleBreakdownChange(key, event.target.value)}
                  displayValue={`${consumptionBreakdown[key]}%`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <SectionLabel>Renewable instruments</SectionLabel>

            <SliderField
              label="RECs / GOs purchased"
              min={0}
              max={Math.max(0, totalConsumptionMwh)}
              step={10}
              value={recMwh}
              onChange={(event) => handleInstrumentChange("rec", event.target.value)}
              displayValue={formatSmartMwh(recMwh)}
            />

            <div className="space-y-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
              <SliderField
                label="PPA volume"
                min={0}
                max={Math.max(0, totalConsumptionMwh)}
                step={10}
                value={ppaMwh}
                onChange={(event) => handleInstrumentChange("ppa", event.target.value)}
                displayValue={formatSmartMwh(ppaMwh)}
              />
              <SliderField
                label="PPA emission factor"
                min={0.001}
                max={0.05}
                step={0.001}
                value={ppaEmissionFactor}
                onChange={(event) => {
                  markDirty();
                  setPpaEmissionFactor(Number(event.target.value));
                }}
                displayValue={`${ppaEmissionFactor.toFixed(3)} kgCO2e/kWh`}
              />
            </div>

            <SliderField
              label="Green tariff supply"
              min={0}
              max={Math.max(0, totalConsumptionMwh)}
              step={10}
              value={greenTariffMwh}
              onChange={(event) => handleInstrumentChange("green", event.target.value)}
              displayValue={formatSmartMwh(greenTariffMwh)}
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>Intensity denominators (optional)</SectionLabel>

            <NumberField
              label="Annual revenue ($M)"
              value={revenueMillion}
              onChange={(event) => {
                markDirty();
                setRevenueMillion(Number(event.target.value));
              }}
              min="0"
              max="10000"
              step="1"
            />

            <NumberField
              label="Number of employees"
              value={employees}
              onChange={(event) => {
                markDirty();
                setEmployees(Number(event.target.value));
              }}
              min="0"
              max="100000"
              step="1"
            />

            <NumberField
              label="Floor area (m2)"
              value={floorAreaM2}
              onChange={(event) => {
                markDirty();
                setFloorAreaM2(Number(event.target.value));
              }}
              min="0"
              max="1000000"
              step="100"
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>SBTi tracking (optional)</SectionLabel>

            <SelectField
              label="Base year"
              value={baseYear}
              onChange={(event) => {
                markDirty();
                setBaseYear(event.target.value);
              }}
              options={BASE_YEARS.map((value) => ({ value, label: value }))}
            />

            <NumberField
              label="Base year emissions (tCO2e)"
              value={baseYearTco2}
              onChange={(event) => {
                markDirty();
                setBaseYearTco2(Number(event.target.value));
              }}
              min="0"
              step="1"
              helper="Leave at 0 to skip SBTi trajectory tracking."
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} loading={loadingAI} variant="primary">
              Calculate Scope 2
            </ActionButton>
            {loadingAI ? <LoadingIndicator message="AI is analyzing Scope 2 reporting context..." /> : null}
          </div>
        </PanelCard>

        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <SectionLabel>Method comparison</SectionLabel>
            {hasResults ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <MethodHeroCard
                    label="Location-based"
                    value={formatTco2(results.locationBased, 1)}
                    detail={
                      results.singleCountry
                        ? `${results.country} grid factor: ${results.weightedLocationFactor.toFixed(3)} kgCO2e/kWh`
                        : `Weighted grid factor: ${results.weightedLocationFactor.toFixed(3)} kgCO2e/kWh`
                    }
                  />
                  <MethodHeroCard
                    label="Market-based"
                    value={formatTco2(results.marketBased, 1)}
                    detail={`RE coverage: ${formatNumber(results.reCoverage, 1)}%`}
                    accent={marketCardAccent}
                  />
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-4 [border:var(--border-default)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge color={results.marketBased <= results.locationBased ? "green" : "amber"}>
                      {formatTco2(Math.abs(results.locationBased - results.marketBased), 1)} tCO2e difference
                    </Badge>
                    <p className="text-sm leading-6 text-[var(--color-text-muted)]">{differenceText}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Run the calculation to compare location-based and market-based Scope 2 emissions for
                your reporting boundary.
              </p>
            )}
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <ScopeMetricCard
              label="Market-based"
              value={hasResults ? formatTco2(results.marketBased, 1) : "--"}
              unit={hasResults ? "tCO2e" : ""}
              accentStyle={hasResults ? { color: "#0F6E56", bg: "#E1F5EE" } : null}
              helper={hasResults ? "Primary result for contractual Scope 2 reporting." : ""}
            />
            <ScopeMetricCard
              label="RE coverage"
              value={hasResults ? formatNumber(results.reCoverage, 1) : "--"}
              unit={hasResults ? "%" : ""}
              helper={hasResults ? "Share of electricity covered by RECs, PPAs, and green tariffs." : ""}
            />
            <ScopeMetricCard
              label="Offset cost"
              value={hasResults ? formatCurrency(results.offsetCost, 0) : "--"}
              helper={hasResults ? "At $65/tCO2, roughly aligned with recent EU ETS pricing." : ""}
            />
            <ScopeMetricCard
              label="Intensity per $M revenue"
              value={
                hasResults && results.intensityMetrics.perRevenueMillion !== null
                  ? formatNumber(results.intensityMetrics.perRevenueMillion, 2)
                  : "--"
              }
              unit={hasResults && results.intensityMetrics.perRevenueMillion !== null ? "tCO2e/$M" : ""}
              helper={
                hasResults && results.intensityMetrics.perRevenueMillion !== null
                  ? "Market-based emissions intensity normalized to company revenue."
                  : "Add annual revenue in the input panel to enable this metric."
              }
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Reduction waterfall</SectionLabel>
            {hasResults && reductionChartData ? (
              <div className="h-[220px]">
                <Bar data={reductionChartData} options={reductionChartOptions} />
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                This view decomposes residual baseline emissions into REC, PPA, and green-tariff
                reductions until the final market-based Scope 2 result.
              </p>
            )}
          </PanelCard>

          {hasResults && (results.recMwh > 0 || results.ppaMwh > 0 || results.greenTariffMwh > 0) ? (
            <PanelCard className="space-y-4">
              <SectionLabel>RE instruments breakdown</SectionLabel>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-center">
                <div className="mx-auto h-[180px] w-full max-w-[220px]">
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
                <div className="grid gap-3">
                  {Object.entries(INSTRUMENT_META).map(([key, meta]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3"
                      style={{
                        backgroundColor: meta.background,
                        border: `1px solid ${meta.color}`,
                        color: meta.color,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatNumber(results.coverageBreakdown[key], 0)} MWh
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </PanelCard>
          ) : null}

          {hasResults && results.sbti ? (
            <PanelCard className="space-y-4">
              <SectionLabel>SBTi alignment</SectionLabel>
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  1.5C pathway requires{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {formatTco2(results.sbti.requiredTarget, 1)} tCO2e
                  </span>{" "}
                  by {results.reportingYear}.
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      results.sbti.onTrack ? "bg-[var(--color-brand)]" : "bg-[#A32D2D]"
                    )}
                    style={{
                      width: `${Math.max(
                        6,
                        Math.min(100, (results.marketBased / Math.max(results.sbti.requiredTarget, 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Your market-based
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                      {formatTco2(results.marketBased, 1)} tCO2e
                    </p>
                  </div>
                  <div
                    className="rounded-[var(--radius-md)] px-4 py-3"
                    style={{
                      backgroundColor: results.sbti.onTrack ? "#E1F5EE" : "#FCEBEB",
                      border: `1px solid ${results.sbti.onTrack ? "#1D9E75" : "#A32D2D"}`,
                      color: results.sbti.onTrack ? "#0F6E56" : "#791F1F",
                    }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                      Status
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {results.sbti.onTrack ? "On track" : "Behind target"}
                    </p>
                    <p className="mt-2 text-sm opacity-85">
                      Gap: {formatTco2(Math.max(0, results.sbti.gap), 1)} tCO2e reduction needed.
                    </p>
                  </div>
                </div>
              </div>
            </PanelCard>
          ) : null}

          <PanelCard className="space-y-4">
            <SectionLabel>Reporting standards note</SectionLabel>
            <p className="text-sm leading-7 text-[var(--color-text-muted)]">
              This calculation follows GHG Protocol Scope 2 Guidance. Market-based reporting uses
              supplier-specific emission factors, RECs / GOs, green tariffs, and renewable PPAs.
              Required for EU CSRD (2025), CDP disclosures, GRI 305-2, and TCFD-aligned climate
              reporting.
            </p>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing Scope 2 reporting context..." />
            ) : aiAnalysis ? (
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                {aiAnalysis}
              </p>
            ) : hasResults ? (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                AI analysis unavailable for this calculation.
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate Scope 2 emissions to generate reporting context, RE instrument assessment,
                and recommended next steps for contractual decarbonization.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Scope 2 Calculator"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
