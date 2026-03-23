import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { ArrowRightIcon, BoltIcon, SunIcon } from "@heroicons/react/24/outline";
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
import { calcLossByCategory, calcLossChain } from "../../lib/pvLossCalc";

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip
);

const LOSS_TYPE_COLORS = {
  irradiance: "#EF9F27",
  module: "#F09595",
  dc: "#E24B4A",
  ac: "#A32D2D",
  system: "#888780",
  output: "#1D9E75",
  start: "rgba(0,0,0,0)",
};

const TEMP_COEFFICIENT_PRESETS = [
  { label: "Mono-Si", value: -0.35 },
  { label: "Poly-Si", value: -0.4 },
  { label: "HJT", value: -0.25 },
];

const CATEGORY_META = [
  { key: "irradiance", label: "Irradiance", color: "#EF9F27" },
  { key: "module", label: "Module", color: "#F09595" },
  { key: "dc", label: "DC", color: "#E24B4A" },
  { key: "ac", label: "AC", color: "#A32D2D" },
  { key: "system", label: "System", color: "#888780" },
];

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

function formatPercent(value, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${formatNumber(value, maximumFractionDigits)}%`;
}

function formatAzimuth(azimuth) {
  if (azimuth === 0) {
    return "0 deg (South)";
  }

  if (azimuth < 0) {
    return `${azimuth} deg (East of south)`;
  }

  return `${azimuth} deg (West of south)`;
}

function getPrStatus(prPercent) {
  if (prPercent > 80) {
    return {
      color: "#1D9E75",
      bg: "#E1F5EE",
      label: "Strong",
    };
  }

  if (prPercent >= 75) {
    return {
      color: "#854F0B",
      bg: "#FAEEDA",
      label: "Acceptable",
    };
  }

  return {
    color: "#A32D2D",
    bg: "#FCEBEB",
    label: "Weak",
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

function PVMetricCard({ label, value, unit, accentStyle = null, helper = null }) {
  const isAccent = Boolean(accentStyle);
  const wrapperStyle = isAccent
    ? {
        backgroundColor: accentStyle.bg,
        border: `1px solid ${accentStyle.color}`,
        color: accentStyle.color,
      }
    : undefined;
  const metaStyle = isAccent ? { color: accentStyle.color, opacity: 0.8 } : undefined;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-5",
        !isAccent &&
          "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]"
      )}
      style={wrapperStyle}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.18em]",
          !isAccent && "text-[var(--color-text-muted)]"
        )}
        style={metaStyle}
      >
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? (
          <span
            className={cn(
              "pb-1 text-sm font-medium",
              !isAccent && "text-[var(--color-text-muted)]"
            )}
            style={metaStyle}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {helper ? (
        <p
          className={cn(
            "mt-3 text-sm leading-6",
            !isAccent && "text-[var(--color-text-muted)]"
          )}
          style={metaStyle}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function LossLegend() {
  const items = [
    { label: "Delivered energy", color: "#5DCAA5" },
    { label: "Irradiance losses", color: LOSS_TYPE_COLORS.irradiance },
    { label: "Module losses", color: LOSS_TYPE_COLORS.module },
    { label: "DC losses", color: LOSS_TYPE_COLORS.dc },
    { label: "AC losses", color: LOSS_TYPE_COLORS.ac },
    { label: "System losses", color: LOSS_TYPE_COLORS.system },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium text-[var(--color-text)] [border:var(--border-default)]"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function buildWaterfallRows(results) {
  if (!results) {
    return [];
  }

  return [
    ...results.steps,
    {
      name: "Net AC output",
      value: results.netAC,
      loss: 0,
      lossType: "output",
    },
  ];
}

function buildLossPrompt(results) {
  const grossEnergy = results.grossEnergy || 1;
  const getStep = (name) => results.steps.find((step) => step.name === name) ?? { loss: 0 };
  const soiling = getStep("Soiling / dust").loss;
  const reflection = getStep("Reflection (IAM)").loss;
  const temp = getStep("Temperature").loss;
  const quality = getStep("Module quality / LID").loss;
  const dcWiring = getStep("DC wiring losses").loss;
  const inverter = getStep("Inverter losses").loss;
  const acCombined = getStep("AC wiring losses").loss + getStep("Transformer losses").loss;
  const availability = getStep("Downtime / availability").loss;
  const shading = getStep("Shading losses").loss;

  return [
    "Analyze this PV system loss breakdown:",
    `Location: ${results.city}, System: ${results.systemKwp.toFixed(1)}kWp`,
    `Gross irradiance: ${Math.round(results.annualIrradiance)} kWh/m^2/yr`,
    `Net AC output: ${Math.round(results.netAC)} kWh/yr`,
    `Performance Ratio: ${results.prPercent.toFixed(1)}%`,
    "",
    "Loss chain (kWh lost, % of gross):",
    `Soiling: ${Math.round(soiling)}kWh (${((soiling / grossEnergy) * 100).toFixed(1)}%)`,
    `Reflection: ${Math.round(reflection)}kWh (${((reflection / grossEnergy) * 100).toFixed(1)}%)`,
    `Temperature: ${Math.round(temp)}kWh (${((temp / grossEnergy) * 100).toFixed(1)}%)`,
    `Module quality: ${Math.round(quality)}kWh (${((quality / grossEnergy) * 100).toFixed(1)}%)`,
    `DC wiring: ${Math.round(dcWiring)}kWh (${((dcWiring / grossEnergy) * 100).toFixed(1)}%)`,
    `Inverter: ${Math.round(inverter)}kWh (${((inverter / grossEnergy) * 100).toFixed(1)}%)`,
    `AC wiring+transformer: ${Math.round(acCombined)}kWh (${((acCombined / grossEnergy) * 100).toFixed(1)}%)`,
    `Availability: ${Math.round(availability)}kWh (${((availability / grossEnergy) * 100).toFixed(1)}%)`,
    `Shading: ${Math.round(shading)}kWh (${((shading / grossEnergy) * 100).toFixed(1)}%)`,
    "",
    `Largest loss: ${results.largestLossStep.name} at ${results.largestLossPctOfGross.toFixed(1)}%`,
    "Industry PR benchmark: 75-85%",
    "",
    "Provide 4 sentences covering:",
    "1. PR assessment vs industry benchmark",
    "2. Top 2 loss sources and their reducibility",
    "3. Most impactful single improvement to make",
    "4. Expected PR range for this climate and system type",
  ].join("\n");
}

function buildPvLossPdfData(results, aiAnalysis) {
  const pdfRows = buildWaterfallRows(results);

  return {
    inputs: {
      Location: results.city,
      "Avg irradiance": `${results.avgIrradiance.toFixed(2)} kWh/m^2/day`,
      "Annual irradiance": `${Math.round(results.annualIrradiance)} kWh/m^2/yr`,
      "System size": `${results.systemKwp.toFixed(1)} kWp`,
      Tilt: `${results.tilt} deg`,
      Azimuth: formatAzimuth(results.azimuth),
      "Shading loss": `${results.shadingLossPct.toFixed(1)}%`,
      "Soiling loss": `${results.soilingLossPct.toFixed(1)}%`,
      "Reflection loss": `${results.reflectionLossPct.toFixed(1)}%`,
      "Spectral loss": `${results.spectralLossPct.toFixed(1)}%`,
      "Temp coefficient": `${results.tempCoefficient.toFixed(2)}%/degC`,
      "Operating temp": `${results.avgOperatingTemp.toFixed(0)} degC`,
      "Module quality": `${results.moduleQualityPct.toFixed(1)}%`,
      "DC wiring loss": `${results.dcWiringLossPct.toFixed(1)}%`,
      "Inverter efficiency": `${results.inverterEffPct.toFixed(1)}%`,
      "AC wiring loss": `${results.acWiringLossPct.toFixed(1)}%`,
      "Transformer loss": `${results.transformerLossPct.toFixed(1)}%`,
      Availability: `${results.availabilityPct.toFixed(1)}%`,
    },
    metrics: [
      { label: "Net AC Output", value: formatNumber(results.netAC, 0), unit: "kWh/year" },
      { label: "Performance Ratio", value: results.prPercent.toFixed(1), unit: "%" },
      { label: "Total Losses", value: formatNumber(results.totalLoss, 0), unit: "kWh/year" },
      {
        label: "Largest Loss",
        value: results.largestLossStep.name,
        unit: formatPercent(results.largestLossPctOfGross, 1),
      },
    ],
    monthlyData: pdfRows.map((row) => Math.round(row.value)),
    monthlyLabels: [
      "Gross",
      "Soiling",
      "IAM",
      "Spectral",
      "Shading",
      "Temp",
      "Quality",
      "DC",
      "Inv",
      "AC",
      "Transf.",
      "Avail.",
      "Net AC",
    ],
    aiAnalysis,
  };
}

export default function PVLossBreakdown() {
  const [city, setCity] = useState("");
  const [avgIrradiance, setAvgIrradiance] = useState(null);
  const [systemKwp, setSystemKwp] = useState(10);
  const [tilt, setTilt] = useState(30);
  const [azimuth, setAzimuth] = useState(0);
  const [shadingLossPct, setShadingLossPct] = useState(3);
  const [soilingLossPct, setSoilingLossPct] = useState(2);
  const [reflectionLossPct, setReflectionLossPct] = useState(3);
  const [spectralLossPct, setSpectralLossPct] = useState(1.5);
  const [tempCoefficient, setTempCoefficient] = useState(-0.35);
  const [avgOperatingTemp, setAvgOperatingTemp] = useState(25);
  const [moduleQualityPct, setModuleQualityPct] = useState(2);
  const [dcWiringLossPct, setDcWiringLossPct] = useState(1.5);
  const [inverterEffPct, setInverterEffPct] = useState(97);
  const [acWiringLossPct, setAcWiringLossPct] = useState(0.5);
  const [transformerLossPct, setTransformerLossPct] = useState(0.5);
  const [availabilityPct, setAvailabilityPct] = useState(99);
  const [results, setResults] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [pdfData, setPdfData] = useState(null);
  const [error, setError] = useState("");

  const hasResults = Boolean(results);
  const isBusy = loading || loadingLocation;
  const liveAnnualIrradiance = avgIrradiance === null ? null : avgIrradiance * 365;
  const prStatus = hasResults ? getPrStatus(results.prPercent) : null;

  const waterfallRows = useMemo(() => buildWaterfallRows(results), [results]);

  const waterfallData = useMemo(
    () => ({
      labels: waterfallRows.map((row) => row.name),
      datasets: [
        {
          label: "Delivered energy",
          data: waterfallRows.map((row) => Number(row.value.toFixed(2))),
          backgroundColor: waterfallRows.map((row) =>
            row.lossType === "output" ? LOSS_TYPE_COLORS.output : "#5DCAA5"
          ),
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 18,
        },
        {
          label: "Loss at this step",
          data: waterfallRows.map((row) => Number((row.loss || 0).toFixed(2))),
          backgroundColor: waterfallRows.map((row) => LOSS_TYPE_COLORS[row.lossType] || "rgba(0,0,0,0)"),
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    }),
    [waterfallRows]
  );

  const waterfallOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const row = waterfallRows[context.dataIndex];
              const grossEnergy = results?.grossEnergy || 1;

              if (!row) {
                return "";
              }

              if (context.datasetIndex === 0) {
                return ` Remaining energy: ${formatNumber(row.value, 0)} kWh/year`;
              }

              if (!row.loss) {
                return " Loss at this step: 0 kWh/year";
              }

              return ` Loss at this step: ${formatNumber(row.loss, 0)} kWh/year (${formatPercent((row.loss / grossEnergy) * 100, 1)})`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: "kWh/year",
          },
          ticks: {
            callback(value) {
              return formatNumber(value, 0);
            },
          },
        },
        y: {
          stacked: true,
          grid: {
            display: false,
          },
        },
      },
    }),
    [results, waterfallRows]
  );

  const donutData = useMemo(() => {
    if (!results || results.totalLoss <= 0) {
      return {
        labels: ["No modeled losses"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#CBD5E1"],
            borderWidth: 0,
          },
        ],
      };
    }

    return {
      labels: CATEGORY_META.map((item) => item.label),
      datasets: [
        {
          data: CATEGORY_META.map((item) => Number(results.lossCategories[item.key].toFixed(2))),
          backgroundColor: CATEGORY_META.map((item) => item.color),
          borderWidth: 0,
        },
      ],
    };
  }, [results]);

  const donutOptions = useMemo(
    () => ({
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
              const totalLoss = results?.totalLoss || 1;
              const value = Number(context.parsed) || 0;
              return ` ${context.label}: ${formatNumber(value, 0)} kWh (${formatPercent((value / totalLoss) * 100, 1)})`;
            },
          },
        },
      },
    }),
    [results]
  );

  async function handleFetchIrradiance() {
    const query = city.trim();

    if (!query) {
      setError("Please enter a city name.");
      return;
    }

    setError("");
    setAiAnalysis("");
    setResults(null);
    setPdfData(null);
    setAvgIrradiance(null);
    setLoadingLocation(true);

    try {
      const locationResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!locationResponse.ok) {
        throw new Error("City not found. Try a different spelling.");
      }

      const locationData = await locationResponse.json();
      const location = locationData?.[0];

      if (!location) {
        throw new Error("City not found. Try a different spelling.");
      }

      const latitude = Number.parseFloat(location.lat);
      const longitude = Number.parseFloat(location.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("City not found. Try a different spelling.");
      }

      const climateResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=2023-01-01&end_date=2023-12-31&daily=shortwave_radiation_sum&timezone=auto`
      );

      if (!climateResponse.ok) {
        throw new Error("Climate data unavailable for this location.");
      }

      const climateData = await climateResponse.json();
      const values = climateData?.daily?.shortwave_radiation_sum;

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error("Climate data unavailable for this location.");
      }

      const cleanValues = values.map(Number).filter((value) => Number.isFinite(value));

      if (!cleanValues.length) {
        throw new Error("Climate data unavailable for this location.");
      }

      const nextAvgIrradiance =
        cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;

      setAvgIrradiance(nextAvgIrradiance);
    } catch (fetchError) {
      setError(fetchError.message || "Climate data unavailable for this location.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function buildResults() {
    if (!Number.isFinite(avgIrradiance)) {
      throw new Error("Fetch irradiance data first.");
    }

    const annualIrradiance = avgIrradiance * 365;
    const nextResults = calcLossChain({
      grossIrradiance: annualIrradiance,
      systemKwp,
      tilt,
      azimuth,
      soilingLossPct,
      reflectionLossPct,
      spectralLossPct,
      tempCoefficient,
      avgOperatingTemp,
      moduleQualityPct,
      dcWiringLossPct,
      inverterEffPct,
      acWiringLossPct,
      transformerLossPct,
      availabilityPct,
      shadingLossPct,
    });

    const lossCategories = calcLossByCategory(nextResults.steps);
    const largestLossStep =
      nextResults.steps
        .filter((step) => step.lossType !== "start")
        .sort((left, right) => right.loss - left.loss)[0] ?? {
        name: "No losses modeled",
        loss: 0,
      };
    const prPercent = nextResults.overallPR * 100;
    const largestLossPctOfGross =
      nextResults.grossEnergy > 0 ? (largestLossStep.loss / nextResults.grossEnergy) * 100 : 0;

    return {
      ...nextResults,
      city: city.trim(),
      avgIrradiance,
      annualIrradiance,
      systemKwp,
      tilt,
      azimuth,
      shadingLossPct,
      soilingLossPct,
      reflectionLossPct,
      spectralLossPct,
      tempCoefficient,
      avgOperatingTemp,
      moduleQualityPct,
      dcWiringLossPct,
      inverterEffPct,
      acWiringLossPct,
      transformerLossPct,
      availabilityPct,
      lossCategories,
      largestLossStep,
      largestLossPctOfGross,
      prPercent,
    };
  }

  async function handleCalculateLosses() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);
    setLoading(true);

    let nextResults;

    try {
      nextResults = buildResults();
      setResults(nextResults);
      const nextPdfData = buildPvLossPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.pvloss,
        createToolReportSnapshot({
          toolName: "PV Loss Breakdown",
          inputs: {
            city: city.trim(),
            avgIrradiance,
            systemKwp,
            tilt,
            azimuth,
            shadingLossPct,
            soilingLossPct,
            reflectionLossPct,
            spectralLossPct,
            tempCoefficient,
            avgOperatingTemp,
            moduleQualityPct,
            dcWiringLossPct,
            inverterEffPct,
            acWiringLossPct,
            transformerLossPct,
            availabilityPct,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "PV loss calculation failed.");
      setResults(null);
      setLoading(false);
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildLossPrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildPvLossPdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.pvloss,
        createToolReportSnapshot({
          toolName: "PV Loss Breakdown",
          inputs: {
            city: city.trim(),
            avgIrradiance,
            systemKwp,
            tilt,
            azimuth,
            shadingLossPct,
            soilingLossPct,
            reflectionLossPct,
            spectralLossPct,
            tempCoefficient,
            avgOperatingTemp,
            moduleQualityPct,
            dcWiringLossPct,
            inverterEffPct,
            acWiringLossPct,
            transformerLossPct,
            availabilityPct,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildPvLossPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.pvloss,
        createToolReportSnapshot({
          toolName: "PV Loss Breakdown",
          inputs: {
            city: city.trim(),
            avgIrradiance,
            systemKwp,
            tilt,
            azimuth,
            shadingLossPct,
            soilingLossPct,
            reflectionLossPct,
            spectralLossPct,
            tempCoefficient,
            avgOperatingTemp,
            moduleQualityPct,
            dcWiringLossPct,
            inverterEffPct,
            acWiringLossPct,
            transformerLossPct,
            availabilityPct,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } finally {
      setLoadingAI(false);
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="teal">New tool</Badge>
          <Badge color="blue">Open-Meteo + Gemini</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          PV Loss Breakdown
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          PVsyst-style loss diagram from raw solar resource to final AC output, with a technical
          loss chain that shows exactly where performance is being lost.
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <PanelCard className="space-y-6">
          <div className="space-y-4">
            <SectionLabel>System & location</SectionLabel>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Enter city"
                className="min-h-[48px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]"
              />
              <button
                type="button"
                onClick={handleFetchIrradiance}
                disabled={loadingLocation || loading}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingLocation ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
                  />
                ) : null}
                <span>Fetch irradiance</span>
              </button>
            </div>

            {loadingLocation ? <LoadingIndicator message="Fetching irradiance data..." /> : null}

            {avgIrradiance !== null ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Avg irradiance: {formatNumber(avgIrradiance, 2)} kWh/m^2/day
                  </p>
                  <Badge color="blue">Open-Meteo 2023</Badge>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Annualized irradiance: {formatNumber(liveAnnualIrradiance, 0)} kWh/m^2/yr
                </p>
              </div>
            ) : null}

            <SliderField
              label="System size"
              min={1}
              max={100}
              step={1}
              value={systemKwp}
              onChange={(event) => setSystemKwp(Number(event.target.value))}
              displayValue={`${systemKwp.toFixed(0)} kWp`}
            />
            <SliderField
              label="Tilt"
              min={0}
              max={60}
              step={1}
              value={tilt}
              onChange={(event) => setTilt(Number(event.target.value))}
              displayValue={`${tilt} deg`}
            />
            <SliderField
              label="Azimuth"
              min={-90}
              max={90}
              step={5}
              value={azimuth}
              onChange={(event) => setAzimuth(Number(event.target.value))}
              displayValue={`${azimuth} deg`}
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>Irradiance losses</SectionLabel>
            <div className="space-y-2">
              <SliderField
                label="Soiling / dust"
                min={0}
                max={10}
                step={0.1}
                value={soilingLossPct}
                onChange={(event) => setSoilingLossPct(Number(event.target.value))}
                displayValue={formatPercent(soilingLossPct, 1)}
              />
              <p className="text-sm text-[var(--color-text-muted)]">Desert: 5-8%, Humid: 1-2%</p>
            </div>
            <SliderField
              label="Reflection (IAM)"
              min={1}
              max={6}
              step={0.1}
              value={reflectionLossPct}
              onChange={(event) => setReflectionLossPct(Number(event.target.value))}
              displayValue={formatPercent(reflectionLossPct, 1)}
            />
            <SliderField
              label="Spectral losses"
              min={0}
              max={3}
              step={0.1}
              value={spectralLossPct}
              onChange={(event) => setSpectralLossPct(Number(event.target.value))}
              displayValue={formatPercent(spectralLossPct, 1)}
            />
            <div className="space-y-2">
              <SliderField
                label="Shading losses"
                min={0}
                max={20}
                step={0.1}
                value={shadingLossPct}
                onChange={(event) => setShadingLossPct(Number(event.target.value))}
                displayValue={formatPercent(shadingLossPct, 1)}
              />
              <p className="text-sm text-[var(--color-text-muted)]">
                Import from{" "}
                <Link href="/tools/shading" className="font-semibold text-[var(--color-brand)]">
                  Shading Analyzer
                </Link>
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <SectionLabel>Module losses</SectionLabel>
            <div className="space-y-3">
              <SliderField
                label="Temperature coefficient"
                min={-0.5}
                max={-0.2}
                step={0.01}
                value={tempCoefficient}
                onChange={(event) => setTempCoefficient(Number(event.target.value))}
                displayValue={`${tempCoefficient.toFixed(2)}%/degC`}
              />
              <div className="flex flex-wrap gap-2">
                {TEMP_COEFFICIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setTempCoefficient(preset.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors duration-200 [border:var(--border-default)]",
                      Math.abs(tempCoefficient - preset.value) < 0.001
                        ? "border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-brand)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    )}
                  >
                    {preset.label}: {preset.value.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
            <SliderField
              label="Avg operating temp above STC"
              min={10}
              max={40}
              step={1}
              value={avgOperatingTemp}
              onChange={(event) => setAvgOperatingTemp(Number(event.target.value))}
              displayValue={`${avgOperatingTemp} degC`}
            />
            <SliderField
              label="Module quality / LID"
              min={0}
              max={5}
              step={0.1}
              value={moduleQualityPct}
              onChange={(event) => setModuleQualityPct(Number(event.target.value))}
              displayValue={formatPercent(moduleQualityPct, 1)}
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>System losses</SectionLabel>
            <SliderField
              label="DC wiring losses"
              min={0.5}
              max={5}
              step={0.1}
              value={dcWiringLossPct}
              onChange={(event) => setDcWiringLossPct(Number(event.target.value))}
              displayValue={formatPercent(dcWiringLossPct, 1)}
            />
            <SliderField
              label="Inverter efficiency"
              min={93}
              max={99}
              step={0.1}
              value={inverterEffPct}
              onChange={(event) => setInverterEffPct(Number(event.target.value))}
              displayValue={formatPercent(inverterEffPct, 1)}
            />
            <SliderField
              label="AC wiring losses"
              min={0.1}
              max={2}
              step={0.1}
              value={acWiringLossPct}
              onChange={(event) => setAcWiringLossPct(Number(event.target.value))}
              displayValue={formatPercent(acWiringLossPct, 1)}
            />
            <SliderField
              label="Transformer losses"
              min={0}
              max={2}
              step={0.1}
              value={transformerLossPct}
              onChange={(event) => setTransformerLossPct(Number(event.target.value))}
              displayValue={formatPercent(transformerLossPct, 1)}
            />
            <SliderField
              label="System availability"
              min={95}
              max={100}
              step={0.1}
              value={availabilityPct}
              onChange={(event) => setAvailabilityPct(Number(event.target.value))}
              displayValue={formatPercent(availabilityPct, 1)}
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculateLosses} loading={isBusy} variant="primary">
              Calculate losses
            </ActionButton>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing PV losses..." />
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Fetch irradiance first, then calculate the full loss chain from gross resource to
                final AC output.
              </p>
            )}
          </div>
        </PanelCard>

        <div className="space-y-6">
          <PanelCard
            className="space-y-3"
            style={
              prStatus
                ? {
                    backgroundColor: prStatus.bg,
                    border: `1px solid ${prStatus.color}`,
                    color: prStatus.color,
                  }
                : undefined
            }
          >
            <SectionLabel>Performance ratio</SectionLabel>
            <div className="flex flex-col gap-2">
              <p className="text-[34px] font-semibold tracking-[-0.03em]">
                Performance Ratio: {hasResults ? results.prPercent.toFixed(1) : "--"}%
              </p>
              <p className="text-sm font-medium opacity-80">Industry benchmark: 75-85%</p>
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <div className="flex flex-col gap-3">
              <SectionLabel>Loss waterfall</SectionLabel>
              <LossLegend />
            </div>
            <div className="h-[380px]">
              <Bar data={waterfallData} options={waterfallOptions} />
            </div>
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <PVMetricCard
              label="Net AC output"
              value={hasResults ? formatNumber(results.netAC, 0) : "--"}
              unit="kWh/year"
              accentStyle={{ bg: "#E1F5EE", color: "#1D9E75" }}
            />
            <PVMetricCard
              label="Performance ratio"
              value={hasResults ? results.prPercent.toFixed(1) : "--"}
              unit="%"
              accentStyle={prStatus ? { bg: prStatus.bg, color: prStatus.color } : null}
              helper={hasResults && prStatus ? prStatus.label : null}
            />
            <PVMetricCard
              label="Total losses"
              value={hasResults ? formatNumber(results.totalLoss, 0) : "--"}
              unit="kWh/year"
            />
            <PVMetricCard
              label="Largest loss source"
              value={hasResults ? results.largestLossStep.name : "--"}
              unit={hasResults ? formatPercent(results.largestLossPctOfGross, 1) : ""}
              helper={
                hasResults
                  ? `${formatNumber(results.largestLossStep.loss, 0)} kWh/year lost`
                  : null
              }
            />
          </div>

          <PanelCard className="space-y-5">
            <SectionLabel>Loss categories</SectionLabel>
            <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto h-[180px] w-[180px]">
                <Doughnut data={donutData} options={donutOptions} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CATEGORY_META.map((item) => {
                  const value = hasResults ? results.lossCategories[item.key] : null;
                  const totalLoss = results?.totalLoss || 1;

                  return (
                    <div
                      key={item.key}
                      className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-medium text-[var(--color-text)]">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--color-text)]">
                          {hasResults ? formatPercent((value / totalLoss) * 100, 1) : "--"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        {hasResults ? `${formatNumber(value, 0)} kWh` : "--"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Next step</SectionLabel>
            <div className="grid gap-3">
              <Link
                href="/tools/inverter-sizing"
                className="block rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-brand-light)] text-[var(--color-brand)]">
                    <BoltIcon className="h-5 w-5" />
                  </span>
                  <ArrowRightIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                  Inverter Sizing
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  Use the stabilized net AC output and performance ratio as the basis for inverter
                  architecture checks.
                </p>
              </Link>
              <ProjectReportCta
                variant="card"
                title="Generate Project Report"
                description="Carry the PV loss chain into the final project-wide feasibility report."
              />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing PV losses..." />
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
                Calculate the loss chain to generate an engineering interpretation of the system
                performance ratio and improvement priorities.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="PV Loss Breakdown"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
        </div>
      </div>
    </section>
  );
}
