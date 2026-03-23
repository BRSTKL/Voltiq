import { useEffect, useMemo, useState } from "react";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
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
  STATIC_CARBON_DATA,
  ZONE_CODES,
  calcCO2Emissions,
  calcEquivalents,
  calcRenewablePct,
  calcSavingsVsAverage,
  classifyIntensity,
} from "../../lib/carbonCalc";

ChartJS.register(ArcElement, Tooltip, Legend);

const COUNTRIES = Object.keys(STATIC_CARBON_DATA).sort((left, right) =>
  left.localeCompare(right)
);

const COUNTRY_FLAGS = {
  Argentina: "\uD83C\uDDE6\uD83C\uDDF7",
  Australia: "\uD83C\uDDE6\uD83C\uDDFA",
  Austria: "\uD83C\uDDE6\uD83C\uDDF9",
  Belgium: "\uD83C\uDDE7\uD83C\uDDEA",
  Brazil: "\uD83C\uDDE7\uD83C\uDDF7",
  Canada: "\uD83C\uDDE8\uD83C\uDDE6",
  China: "\uD83C\uDDE8\uD83C\uDDF3",
  Denmark: "\uD83C\uDDE9\uD83C\uDDF0",
  France: "\uD83C\uDDEB\uD83C\uDDF7",
  Germany: "\uD83C\uDDE9\uD83C\uDDEA",
  India: "\uD83C\uDDEE\uD83C\uDDF3",
  Italy: "\uD83C\uDDEE\uD83C\uDDF9",
  Japan: "\uD83C\uDDEF\uD83C\uDDF5",
  Mexico: "\uD83C\uDDF2\uD83C\uDDFD",
  Netherlands: "\uD83C\uDDF3\uD83C\uDDF1",
  Norway: "\uD83C\uDDF3\uD83C\uDDF4",
  Poland: "\uD83C\uDDF5\uD83C\uDDF1",
  Portugal: "\uD83C\uDDF5\uD83C\uDDF9",
  "Saudi Arabia": "\uD83C\uDDF8\uD83C\uDDE6",
  "South Africa": "\uD83C\uDDFF\uD83C\uDDE6",
  "South Korea": "\uD83C\uDDF0\uD83C\uDDF7",
  Spain: "\uD83C\uDDEA\uD83C\uDDF8",
  Sweden: "\uD83C\uDDF8\uD83C\uDDEA",
  Switzerland: "\uD83C\uDDE8\uD83C\uDDED",
  Turkey: "\uD83C\uDDF9\uD83C\uDDF7",
  UAE: "\uD83C\uDDE6\uD83C\uDDEA",
  "United Kingdom": "\uD83C\uDDEC\uD83C\uDDE7",
  "United States": "\uD83C\uDDFA\uD83C\uDDF8",
};

const MIX_COLORS = {
  nuclear: "#378ADD",
  hydro: "#1D9E75",
  wind: "#5DCAA5",
  solar: "#EF9F27",
  gas: "#888780",
  coal: "#444441",
  biomass: "#639922",
  oil: "#BA7517",
  renewables: "#7FB03B",
  other: "#B4B2A9",
};

const BENCHMARKS = [
  { label: "Norway", value: 28, color: "bg-[#0F6E56]", textClass: "text-[#0F6E56]", level: 0, pdfColor: "#0F6E56" },
  { label: "France", value: 56, color: "bg-[var(--color-brand)]", textClass: "text-[var(--color-brand)]", level: 1, pdfColor: "#1D9E75" },
  { label: "EU avg", value: 255, color: "bg-[#378ADD]", textClass: "text-[#378ADD]", level: 0, pdfColor: "#378ADD" },
  { label: "World avg", value: 475, color: "bg-[#EF9F27]", textClass: "text-[#BA7517]", level: 1, pdfColor: "#EF9F27" },
  { label: "India", value: 632, color: "bg-[#A32D2D]", textClass: "text-[#A32D2D]", level: 0, pdfColor: "#A32D2D" },
  { label: "South Africa", value: 750, color: "bg-[#791F1F]", textClass: "text-[#791F1F]", level: 1, pdfColor: "#791F1F" },
];

const PERIOD_META = {
  daily: { label: "Daily", unit: "day", annualMultiplier: 365 },
  monthly: { label: "Monthly", unit: "month", annualMultiplier: 12 },
  annual: { label: "Annual", unit: "year", annualMultiplier: 1 },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "64%",
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${context.label}: ${context.parsed.toFixed(0)}%`;
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

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPeriodMeta(consumptionType) {
  return PERIOD_META[consumptionType] || PERIOD_META.daily;
}

function getAnnualizedConsumption(consumptionKwh, consumptionType) {
  return consumptionKwh * getPeriodMeta(consumptionType).annualMultiplier;
}

function formatMixLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildTopSources(mix) {
  if (!mix) {
    return "mix data unavailable";
  }

  return Object.entries(mix)
    .filter(([, share]) => share > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([source, share]) => `${formatMixLabel(source)} ${share}%`)
    .join(", ");
}

function pickEquivalentDisplay(equivalents) {
  if (!equivalents) {
    return { label: "--", value: "--", type: "car" };
  }

  const candidates = [
    { type: "car", label: "km by car", value: equivalents.carKm },
    { type: "plane", label: "hours of flying", value: equivalents.flightHours },
    { type: "tree", label: "days of tree absorption", value: equivalents.treeDays },
    { type: "phone", label: "smartphone charges", value: equivalents.smartphoneCharges },
  ];

  const preferred = candidates.find((candidate) => {
    const numericValue = Number(candidate.value);
    return Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 999;
  });

  return preferred || candidates[0];
}

function getEquivalentCards(equivalents) {
  if (!equivalents) {
    return [
      { type: "car", label: "km by car", value: "--" },
      { type: "plane", label: "hours of flying", value: "--" },
      { type: "tree", label: "days of tree absorption", value: "--" },
      { type: "phone", label: "smartphone charges", value: "--" },
    ];
  }

  return [
    { type: "car", label: "km by car", value: formatNumber(equivalents.carKm, 0) },
    { type: "plane", label: "hours of flying", value: formatNumber(equivalents.flightHours, 1) },
    { type: "tree", label: "days of tree absorption", value: formatNumber(equivalents.treeDays, 0) },
    { type: "phone", label: "smartphone charges", value: formatNumber(equivalents.smartphoneCharges, 0) },
  ];
}

function getRenewableAccent(renewablePct) {
  if (renewablePct === null) {
    return "default";
  }

  if (renewablePct > 50) {
    return "green";
  }

  if (renewablePct >= 30) {
    return "amber";
  }

  return "red";
}

function getEmissionsAccent(classification) {
  if (!classification) {
    return "default";
  }

  if (classification.label === "Very low" || classification.label === "Low") {
    return "green";
  }

  if (classification.label === "Moderate") {
    return "amber";
  }

  return "red";
}

function getWinner(primaryMetrics, compareMetrics) {
  if (!primaryMetrics || !compareMetrics) {
    return null;
  }

  if (primaryMetrics.intensity < compareMetrics.intensity) {
    return "primary";
  }

  if (compareMetrics.intensity < primaryMetrics.intensity) {
    return "compare";
  }

  if ((primaryMetrics.renewablePct ?? -1) > (compareMetrics.renewablePct ?? -1)) {
    return "primary";
  }

  if ((compareMetrics.renewablePct ?? -1) > (primaryMetrics.renewablePct ?? -1)) {
    return "compare";
  }

  return null;
}

function buildCarbonPrompt({
  country,
  intensity,
  classification,
  renewablePct,
  topSources,
  consumption,
  periodUnit,
  userCO2,
  savedCO2,
  compareCountry,
  compareIntensity,
}) {
  const comparisonLine =
    compareCountry && compareIntensity !== null
      ? `Compared to ${compareCountry}: ${compareIntensity} gCO2/kWh.`
      : "";

  return `Analyze the electricity grid carbon intensity for ${country}:
Carbon intensity: ${intensity} gCO2/kWh (${classification})
Renewable share: ${renewablePct ?? "N/A"}%
Energy mix: ${topSources}
User consumption: ${consumption} kWh/${periodUnit}
User CO2 emissions: ${userCO2.toFixed(2)} kg CO2/${periodUnit}
CO2 saved vs global average: ${savedCO2.toFixed(2)} kg/${periodUnit}
${comparisonLine}

Provide 4-5 sentences covering:
1. Grid decarbonization assessment and key drivers
2. How the user's consumption compares to national/EU averages
3. Specific actions to reduce personal carbon footprint from electricity (timing, efficiency, renewables)
4. One forward-looking observation about grid trajectory (e.g. planned nuclear, offshore wind targets)
Be specific to ${country}, not generic.`;
}

async function fetchCarbonData(country) {
  const zone = ZONE_CODES[country];
  const staticData = STATIC_CARBON_DATA[country];
  const liveToken = process.env.NEXT_PUBLIC_ELECTRICITYMAPS_TOKEN;

  if (liveToken && zone) {
    try {
      const response = await fetch(
        `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`,
        {
          headers: {
            "auth-token": liveToken,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const liveIntensity = Number(data?.carbonIntensity);

        if (Number.isFinite(liveIntensity)) {
          return {
            country,
            intensity: liveIntensity,
            mix: staticData?.mix ?? null,
            isLive: true,
            updatedAt: data?.updatedAt || data?.datetime || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Silent fallback.
    }
  }

  return {
    country,
    intensity: staticData?.intensity ?? null,
    mix: staticData?.mix ?? null,
    isLive: false,
    updatedAt: null,
  };
}

function buildCarbonPdfData({
  selectedCountry,
  carbonData,
  compareCountry,
  consumptionKwh,
  consumptionType,
  derivedMetrics,
  aiText,
}) {
  const periodMeta = getPeriodMeta(consumptionType);
  const ranking = Object.entries(STATIC_CARBON_DATA)
    .sort((left, right) => left[1].intensity - right[1].intensity)
    .slice(0, 12);
  const energyMix = Object.entries(carbonData.mix ?? {})
    .filter(([, share]) => share > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([source, share]) => ({
      label: formatMixLabel(source),
      share,
      color: MIX_COLORS[source] || MIX_COLORS.other,
    }));

  return {
    inputs: {
      Country: selectedCountry,
      "Data source": carbonData.isLive ? "Live (Electricity Maps)" : "2024 IEA",
      "Carbon intensity": `${Math.round(derivedMetrics.intensity)} gCO2/kWh`,
      Classification: derivedMetrics.classification.label,
      "Renewable share":
        derivedMetrics.renewablePct === null ? "N/A" : `${derivedMetrics.renewablePct}%`,
      [`${periodMeta.label} consumption`]: `${consumptionKwh} kWh/${periodMeta.unit}`,
      "Compare country": compareCountry || "None",
    },
    metrics: [
      { label: "Carbon intensity", value: String(Math.round(derivedMetrics.intensity)), unit: "gCO2/kWh" },
      {
        label: "Renewable share",
        value: derivedMetrics.renewablePct === null ? "--" : String(derivedMetrics.renewablePct),
        unit: "%",
      },
      {
        label: `Your CO2 (${periodMeta.label})`,
        value: derivedMetrics.userCO2.toFixed(2),
        unit: `kg CO2/${periodMeta.unit}`,
      },
      {
        label: "Saved vs global avg",
        value: derivedMetrics.savedCO2.toFixed(2),
        unit: `kg CO2/${periodMeta.unit}`,
      },
    ],
    monthlyData: ranking.map(([, value]) => value.intensity),
    monthlyLabels: ranking.map(([country]) => country.slice(0, 8)),
    energyMix,
    globalBenchmark: {
      min: 0,
      max: 800,
      current: {
        label: selectedCountry,
        value: Math.round(derivedMetrics.intensity),
        color: "#1D9E75",
      },
      items: BENCHMARKS.map((benchmark) => ({
        label: benchmark.label,
        value: benchmark.value,
        color: benchmark.pdfColor,
        level: benchmark.level,
      })),
    },
    aiAnalysis: aiText,
  };
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

function CarbonMetricCard({ label, value, unit, accent = "default", detail }) {
  const variantClasses = {
    default: "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]",
    green: "bg-[var(--color-brand)] text-[var(--color-inverse)]",
    amber: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] [border:var(--border-default)]",
    red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  };
  const metaClasses =
    accent === "default"
      ? "text-[var(--color-text-muted)]"
      : accent === "green"
        ? "text-white/75"
        : "text-current/75";

  return (
    <div className={cn("rounded-[var(--radius-lg)] p-5", variantClasses[accent])}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", metaClasses)}>
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className={cn("pb-1 text-sm font-medium", metaClasses)}>{unit}</span> : null}
      </div>
      {detail ? <p className={cn("mt-3 text-sm leading-6", metaClasses)}>{detail}</p> : null}
    </div>
  );
}

function DataSourceBadge({ isLive, updatedAt, loading }) {
  if (loading) {
    return <LoadingIndicator message="Loading carbon intensity data..." />;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge color={isLive ? "green" : "amber"}>
        {isLive ? "Live data" : "2024 IEA data"}
      </Badge>
      {isLive && updatedAt ? (
        <span className="text-sm text-[var(--color-text-muted)]">
          Updated {formatTimestamp(updatedAt)}
        </span>
      ) : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <PanelCard className="animate-pulse space-y-4">
        <div className="h-5 w-40 rounded bg-[var(--color-surface-secondary)]" />
        <div className="h-10 w-52 rounded bg-[var(--color-surface-secondary)]" />
        <div className="h-6 w-32 rounded-full bg-[var(--color-surface-secondary)]" />
      </PanelCard>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <PanelCard key={item} className="animate-pulse space-y-3">
            <div className="h-4 w-24 rounded bg-[var(--color-surface-secondary)]" />
            <div className="h-10 w-32 rounded bg-[var(--color-surface-secondary)]" />
          </PanelCard>
        ))}
      </div>
      <PanelCard className="h-[290px] animate-pulse bg-[var(--color-surface-secondary)]" />
      <PanelCard className="h-[180px] animate-pulse bg-[var(--color-surface-secondary)]" />
    </div>
  );
}

function EquivalentIcon({ type }) {
  if (type === "plane") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="m2.5 13.5 8-1.8 3.8-7.2 2.1.6-1.5 7.4 4.8 2.2-.4 1.6-5.4-.7-2.6 5.1-1.8-.5.8-5-7 .8z" />
      </svg>
    );
  }

  if (type === "tree") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M12 21v-7" />
        <path d="M7 14c-1.7 0-3-1.3-3-3 0-1.4.9-2.5 2.2-2.9A4.5 4.5 0 0 1 12 4a4.8 4.8 0 0 1 5.1 4.2A3.4 3.4 0 0 1 20 11c0 1.7-1.3 3-3 3Z" />
      </svg>
    );
  }

  if (type === "phone") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M10 5.5h4" />
        <path d="M11.5 18.5h1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M5 16.5 3.5 12 5 7.5h7l2.5 4.5L12 16.5H5Z" />
      <circle cx="17.5" cy="8.5" r="1.5" />
      <circle cx="18.5" cy="16" r="2" />
    </svg>
  );
}

function ComparisonPanel({ primaryCountry, compareCountry, primaryMetrics, compareMetrics, periodUnit }) {
  const winner = getWinner(primaryMetrics, compareMetrics);

  if (!compareCountry) {
    return null;
  }

  if (!compareMetrics) {
    return (
      <PanelCard className="space-y-4">
        <SectionLabel>Country comparison</SectionLabel>
        <LoadingIndicator message="Loading comparison country..." />
      </PanelCard>
    );
  }

  const primaryColumnClass =
    winner === "primary"
      ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
      : "bg-[var(--color-surface)]";
  const compareColumnClass =
    winner === "compare"
      ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
      : "bg-[var(--color-surface)]";

  return (
    <PanelCard className="space-y-4">
      <SectionLabel>Country comparison</SectionLabel>
      <div className="overflow-hidden rounded-[var(--radius-md)] [border:var(--border-default)]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Metric</th>
              <th className={cn("px-4 py-3 font-medium", primaryColumnClass)}>{primaryCountry}</th>
              <th className={cn("px-4 py-3 font-medium", compareColumnClass)}>{compareCountry}</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Carbon intensity",
                primary: `${formatNumber(primaryMetrics.intensity, 0)} gCO2/kWh`,
                compare: `${formatNumber(compareMetrics.intensity, 0)} gCO2/kWh`,
              },
              {
                label: "Renewable share",
                primary: primaryMetrics.renewablePct === null ? "--" : `${primaryMetrics.renewablePct}%`,
                compare: compareMetrics.renewablePct === null ? "--" : `${compareMetrics.renewablePct}%`,
              },
              {
                label: `Your CO2 (${periodUnit})`,
                primary: `${formatNumber(primaryMetrics.userCO2, 2)} kg`,
                compare: `${formatNumber(compareMetrics.userCO2, 2)} kg`,
              },
              {
                label: "CO2 saved vs avg",
                primary: `${formatNumber(primaryMetrics.savedCO2, 2)} kg`,
                compare: `${formatNumber(compareMetrics.savedCO2, 2)} kg`,
              },
            ].map((row) => (
              <tr key={row.label} className="border-t [border-top:var(--border-default)]">
                <td className="px-4 py-3 text-[var(--color-text)]">{row.label}</td>
                <td className={cn("px-4 py-3 font-medium", primaryColumnClass)}>{row.primary}</td>
                <td className={cn("px-4 py-3 font-medium", compareColumnClass)}>{row.compare}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
}

export default function CarbonIntensityTracker() {
  const [selectedCountry, setSelectedCountry] = useState("Germany");
  const [consumptionKwh, setConsumptionKwh] = useState(10);
  const [consumptionType, setConsumptionType] = useState("daily");
  const [compareCountry, setCompareCountry] = useState("");
  const [carbonData, setCarbonData] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");

  const periodMeta = getPeriodMeta(consumptionType);
  const compareOptions = COUNTRIES.filter((country) => country !== selectedCountry);

  useEffect(() => {
    if (selectedCountry === compareCountry) {
      setCompareCountry("");
      setCompareData(null);
    }
  }, [compareCountry, selectedCountry]);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError("");
    setAiAnalysis("");
    setCarbonData(null);

    fetchCarbonData(selectedCountry)
      .then((nextData) => {
        if (ignore) {
          return;
        }

        setCarbonData(nextData);
        setIsLive(nextData.isLive);
      })
      .catch(() => {
        if (!ignore) {
          setError("Carbon intensity data unavailable for this country.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCountry]);

  useEffect(() => {
    let ignore = false;

    setAiAnalysis("");

    if (!compareCountry) {
      setCompareData(null);
      return () => {
        ignore = true;
      };
    }

    setCompareData(null);

    fetchCarbonData(compareCountry)
      .then((nextData) => {
        if (!ignore) {
          setCompareData(nextData);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCompareData(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [compareCountry]);

  const mixEntries = useMemo(() => {
    if (!carbonData?.mix) {
      return [];
    }

    return Object.entries(carbonData.mix)
      .filter(([, share]) => share > 0)
      .sort((left, right) => right[1] - left[1]);
  }, [carbonData]);

  const derivedMetrics = useMemo(() => {
    if (!carbonData || !Number.isFinite(carbonData.intensity)) {
      return null;
    }

    const intensity = carbonData.intensity;
    const renewablePct = calcRenewablePct(carbonData.mix);
    const classification = classifyIntensity(intensity);
    const userCO2 = calcCO2Emissions(consumptionKwh, intensity);
    const savedCO2 = calcSavingsVsAverage(intensity, consumptionKwh);
    const annualizedCO2 = calcCO2Emissions(
      getAnnualizedConsumption(consumptionKwh, consumptionType),
      intensity
    );

    return {
      intensity,
      renewablePct,
      classification,
      userCO2,
      savedCO2,
      annualizedCO2,
      equivalents: calcEquivalents(annualizedCO2),
      topSources: buildTopSources(carbonData.mix),
    };
  }, [carbonData, consumptionKwh, consumptionType]);

  const compareMetrics = useMemo(() => {
    if (!compareData || !Number.isFinite(compareData.intensity)) {
      return null;
    }

    return {
      intensity: compareData.intensity,
      renewablePct: calcRenewablePct(compareData.mix),
      userCO2: calcCO2Emissions(consumptionKwh, compareData.intensity),
      savedCO2: calcSavingsVsAverage(compareData.intensity, consumptionKwh),
    };
  }, [compareData, consumptionKwh]);

  const pdfData = useMemo(() => {
    if (!carbonData || !derivedMetrics) {
      return null;
    }

    return buildCarbonPdfData({
      selectedCountry,
      carbonData,
      compareCountry,
      consumptionKwh,
      consumptionType,
      derivedMetrics,
      aiText: aiAnalysis,
    });
  }, [
    aiAnalysis,
    carbonData,
    compareCountry,
    consumptionKwh,
    consumptionType,
    derivedMetrics,
    selectedCountry,
  ]);

  useEffect(() => {
    if (!pdfData || !carbonData || !derivedMetrics) {
      return;
    }

    saveToolReportResult(
      REPORT_STORAGE_KEYS.carbon,
      createToolReportSnapshot({
        toolName: "Carbon Intensity Tracker",
        inputs: {
          selectedCountry,
          compareCountry,
          consumptionKwh,
          consumptionType,
        },
        results: {
          country: selectedCountry,
          intensity: derivedMetrics.intensity,
          renewablePct: derivedMetrics.renewablePct,
          classification: derivedMetrics.classification,
          userCO2: derivedMetrics.userCO2,
          savedCO2: derivedMetrics.savedCO2,
          annualizedCO2: derivedMetrics.annualizedCO2,
          equivalents: derivedMetrics.equivalents,
          compareMetrics,
          mix: carbonData.mix,
        },
        pdfData,
        aiAnalysis,
      })
    );
  }, [
    aiAnalysis,
    carbonData,
    compareCountry,
    compareMetrics,
    consumptionKwh,
    consumptionType,
    derivedMetrics,
    pdfData,
    selectedCountry,
  ]);

  const equivalentDisplay = derivedMetrics
    ? pickEquivalentDisplay(derivedMetrics.equivalents)
    : { value: "--", label: "--", type: "car" };
  const equivalentCards = getEquivalentCards(derivedMetrics?.equivalents);
  const energyMixChartData = {
    labels: mixEntries.map(([source]) => formatMixLabel(source)),
    datasets: [
      {
        data: mixEntries.map(([, share]) => share),
        backgroundColor: mixEntries.map(([source]) => MIX_COLORS[source] || MIX_COLORS.other),
        borderWidth: 0,
      },
    ],
  };

  async function handleAnalyze() {
    if (!derivedMetrics || !carbonData) {
      return;
    }

    setLoadingAI(true);
    setError("");
    setAiAnalysis("");

    try {
      const analysis = await callGemini(
        buildCarbonPrompt({
          country: selectedCountry,
          intensity: Math.round(derivedMetrics.intensity),
          classification: derivedMetrics.classification.label,
          renewablePct: derivedMetrics.renewablePct,
          topSources: derivedMetrics.topSources,
          consumption: consumptionKwh,
          periodUnit: periodMeta.unit,
          userCO2: derivedMetrics.userCO2,
          savedCO2: derivedMetrics.savedCO2,
          compareCountry,
          compareIntensity: compareMetrics?.intensity ?? null,
        })
      );
      setAiAnalysis(analysis);
    } catch {
      setError("AI analysis failed. Carbon results are still available.");
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="green">Sustainability</Badge>
          <Badge color="teal">Electricity Maps + Gemini</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Carbon Intensity Tracker
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Track grid carbon intensity by country, compare electricity mixes, and quantify the CO2
          footprint of your own consumption.
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <PanelCard className="space-y-6">
          <div className="space-y-5">
            <SectionLabel>Select country</SectionLabel>
            <label className="flex flex-col gap-2">
              <SectionLabel>Country</SectionLabel>
              <select
                value={selectedCountry}
                onChange={(event) => setSelectedCountry(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <SectionLabel>Compare with</SectionLabel>
              <select
                value={compareCountry}
                onChange={(event) => {
                  setCompareCountry(event.target.value);
                  setError("");
                }}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="">None</option>
                {compareOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>

            <DataSourceBadge isLive={isLive} updatedAt={carbonData?.updatedAt} loading={loading} />
          </div>

          <div className="space-y-5">
            <SectionLabel>Your consumption</SectionLabel>
            <SliderField
              label={`${periodMeta.label} consumption`}
              min={1}
              max={10000}
              step={1}
              value={consumptionKwh}
              onChange={(event) => {
                setConsumptionKwh(Number(event.target.value));
                setAiAnalysis("");
                setError("");
              }}
              displayValue={`${formatNumber(consumptionKwh, 0)} kWh/${periodMeta.unit}`}
            />

            <div className="space-y-2">
              <SectionLabel>Consumption type</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PERIOD_META).map(([value, meta]) => {
                  const isActive = value === consumptionType;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setConsumptionType(value);
                        setAiAnalysis("");
                        setError("");
                      }}
                      className={cn(
                        "min-h-[48px] rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition-colors duration-200",
                        isActive
                          ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
                          : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)]"
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ActionButton onClick={handleAnalyze} loading={loadingAI} variant="primary">
              Analyze with AI
            </ActionButton>
            {loadingAI ? <LoadingIndicator message="AI is analyzing grid decarbonization..." /> : null}
          </div>
        </PanelCard>

        {loading || !derivedMetrics ? (
          <LoadingSkeleton />
        ) : (
          <div className="space-y-6">
            <PanelCard className="text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-lg font-medium text-[var(--color-text)]">
                  <span className="mr-2 text-2xl">{COUNTRY_FLAGS[selectedCountry] || ""}</span>
                  {selectedCountry}
                </p>
                <div className="text-[36px] font-semibold leading-none tracking-[-0.04em] text-[var(--color-text)]">
                  {formatNumber(derivedMetrics.intensity, 0)} gCO2/kWh
                </div>
                <span
                  className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                  style={{
                    color: derivedMetrics.classification.color,
                    backgroundColor: derivedMetrics.classification.bg,
                  }}
                >
                  {derivedMetrics.classification.label}
                </span>
                <p className="text-sm text-[var(--color-text-muted)]">
                  EU average: 255 g | Global: 475 g
                </p>
              </div>
            </PanelCard>

            <div className="grid gap-4 sm:grid-cols-2">
              <CarbonMetricCard
                label="Your CO2 emissions"
                value={formatNumber(derivedMetrics.userCO2, 2)}
                unit={`kg CO2/${periodMeta.unit}`}
                accent={getEmissionsAccent(derivedMetrics.classification)}
              />
              <CarbonMetricCard
                label="Renewable share"
                value={derivedMetrics.renewablePct === null ? "--" : formatNumber(derivedMetrics.renewablePct, 0)}
                unit="%"
                accent={getRenewableAccent(derivedMetrics.renewablePct)}
              />
              <CarbonMetricCard
                label="CO2 saved vs global avg"
                value={formatNumber(derivedMetrics.savedCO2, 2)}
                unit={`kg CO2/${periodMeta.unit}`}
                accent="green"
                detail="vs 475g global average"
              />
              <CarbonMetricCard
                label="Equivalent to"
                value={formatNumber(equivalentDisplay.value, equivalentDisplay.type === "plane" ? 1 : 0)}
                unit=""
                detail={equivalentDisplay.label}
              />
            </div>

            <PanelCard className="space-y-5">
              <SectionLabel>Energy mix</SectionLabel>
              {mixEntries.length ? (
                <>
                  <div className="mx-auto h-[220px] max-w-[280px]">
                    <Doughnut data={energyMixChartData} options={doughnutOptions} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {mixEntries.map(([source, share]) => (
                      <div
                        key={source}
                        className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-3 py-2 [border:var(--border-default)]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: MIX_COLORS[source] || MIX_COLORS.other }}
                          />
                          <span className="text-sm text-[var(--color-text)]">
                            {formatMixLabel(source)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--color-text)]">
                          {share}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                  Mix data not available.
                </p>
              )}
            </PanelCard>

            <ComparisonPanel
              primaryCountry={selectedCountry}
              compareCountry={compareCountry}
              primaryMetrics={derivedMetrics}
              compareMetrics={compareMetrics}
              periodUnit={periodMeta.unit}
            />

            <PanelCard className="space-y-5">
              <SectionLabel>Global benchmark</SectionLabel>
              <div className="relative px-2 pt-10">
                <div className="relative h-2 rounded-full bg-[var(--color-overlay-subtle)]">
                  {BENCHMARKS.map((benchmark) => (
                    <div
                      key={benchmark.label}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${(benchmark.value / 800) * 100}%` }}
                    >
                      <span className={cn("block h-3 w-3 rounded-full", benchmark.color)} />
                      <span
                        className={cn(
                          "absolute left-1/2 w-24 -translate-x-1/2 text-center text-[10px] font-semibold",
                          benchmark.textClass,
                          benchmark.level === 0 ? "-top-8" : "top-4"
                        )}
                      >
                        {benchmark.label} {benchmark.value}g
                      </span>
                    </div>
                  ))}
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${Math.max(0, Math.min((derivedMetrics.intensity / 800) * 100, 100))}%` }}
                  >
                    <span className="block h-4 w-4 rounded-full border-2 border-white bg-[var(--color-brand)] shadow-[0_0_0_2px_rgba(29,158,117,0.25)]" />
                    <span className="absolute -top-10 left-1/2 w-24 -translate-x-1/2 text-center text-[10px] font-semibold text-[var(--color-brand)]">
                      {selectedCountry} {Math.round(derivedMetrics.intensity)}g
                    </span>
                  </div>
                </div>
                <div className="mt-12 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-muted)]">
                  <span>0 gCO2/kWh</span>
                  <span>800 gCO2/kWh</span>
                </div>
              </div>
            </PanelCard>

            <PanelCard className="space-y-4">
              <SectionLabel>CO2 equivalents</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                {equivalentCards.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand)]">
                      <EquivalentIcon type={item.type} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">= {item.value}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>

            <PanelCard className="space-y-4">
              <SectionLabel>AI analysis</SectionLabel>
              {loadingAI ? (
                <LoadingIndicator message="AI is analyzing grid decarbonization..." />
              ) : aiAnalysis ? (
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                  {aiAnalysis}
                </p>
              ) : (
                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                  Analyze the current grid profile to generate country-specific decarbonization
                  context, consumption guidance, and forward-looking power-sector commentary.
                </p>
              )}
            </PanelCard>

            <ExportButton
              toolName="Carbon Intensity Tracker"
              data={pdfData}
              disabled={!pdfData}
            />
            {pdfData ? <ProjectReportCta /> : null}
          </div>
        )}
      </div>
    </section>
  );
}
