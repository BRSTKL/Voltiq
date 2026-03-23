import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import {
  ArrowRightIcon,
  BoltIcon,
  CubeTransparentIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { Bar } from "react-chartjs-2";
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
  calcGridScore,
  calcLandRequirement,
  calcRegulatoryScore,
  calcSiteScore,
  calcSolarScore,
  calcTerrainScore,
  classifySite,
  estimateGridConnectionCost,
} from "../../lib/siteCalc";

ChartJS.register(BarController, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const LAND_TYPE_OPTIONS = [
  { value: "flat_open", label: "Flat open land (best)" },
  { value: "agricultural", label: "Agricultural land" },
  { value: "degraded", label: "Degraded / brownfield land (good - avoids food conflict)" },
  { value: "forest", label: "Forest land (avoid)" },
  { value: "urban", label: "Urban / peri-urban" },
  { value: "water", label: "Water body (floating solar)" },
];

const GRID_POLICY_OPTIONS = [
  { value: "favorable", label: "Favorable (fast approval, net metering)" },
  { value: "moderate", label: "Moderate (standard process)" },
  { value: "difficult", label: "Difficult (lengthy process, high fees)" },
];

const SUB_SCORE_META = [
  { key: "solarScore", label: "Solar resource", max: 40, color: "#EF9F27" },
  { key: "gridScore", label: "Grid access", max: 25, color: "#378ADD" },
  { key: "terrainScore", label: "Terrain", max: 20, color: "#1D9E75" },
  { key: "regulatoryScore", label: "Regulatory", max: 15, color: "#7F77DD" },
];

const NEXT_STEP_TOOLS = [
  {
    name: "Solar Yield Estimator",
    description: "Use this location's irradiance for production modeling.",
    href: "/tools/solar",
    Icon: SunIcon,
  },
  {
    name: "Shading Loss Analyzer",
    description: "Analyze horizon obstacles and layout shading risk.",
    href: "/tools/shading",
    Icon: CubeTransparentIcon,
  },
  {
    name: "Cable Sizing Calculator",
    description: "Size the grid connection cable for the selected site.",
    href: "/tools/cable",
    Icon: BoltIcon,
  },
];

const EMPTY_CLASSIFICATION = {
  label: "Awaiting data",
  color: "#64748B",
  bg: "#F8FAFC",
  recommendation: "Fetch solar data and assess the site to see the suitability score.",
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          const maxScore = SUB_SCORE_META[context.dataIndex]?.max ?? 0;
          return ` ${context.label}: ${context.parsed.x}/${maxScore}`;
        },
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      max: 40,
      ticks: {
        stepSize: 10,
      },
      title: {
        display: true,
        text: "Score",
      },
    },
    y: {
      grid: {
        display: false,
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

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `$${formatNumber(value, 0)}`;
}

function getLandTypeLabel(landType) {
  return LAND_TYPE_OPTIONS.find((option) => option.value === landType)?.label ?? landType;
}

function getGridPolicyLabel(gridPolicy) {
  return GRID_POLICY_OPTIONS.find((option) => option.value === gridPolicy)?.label ?? gridPolicy;
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

function SiteMetricCard({ label, value, unit, accentStyle = null }) {
  const isAccent = Boolean(accentStyle);
  const metaStyle = isAccent ? { color: accentStyle.color, opacity: 0.78 } : undefined;
  const wrapperStyle = isAccent
    ? {
        backgroundColor: accentStyle.bg,
        border: `1px solid ${accentStyle.color}`,
        color: accentStyle.color,
      }
    : undefined;

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
    </div>
  );
}

function ScoreRow({ label, value, max, color }) {
  const fillWidth = max > 0 ? `${Math.max(0, Math.min((value / max) * 100, 100))}%` : "0%";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text)]">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-overlay-subtle)]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: fillWidth, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ScoreGauge({ results }) {
  const score = results?.totalScore ?? null;
  const scoreValue = Number.isFinite(score) ? score : 0;
  const classification = results?.classification ?? EMPTY_CLASSIFICATION;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (scoreValue / 100) * circumference;

  return (
    <PanelCard className="space-y-6">
      <SectionLabel>Site score gauge</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="12"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={classification.color}
              strokeLinecap="round"
              strokeWidth="12"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[40px] font-semibold tracking-[-0.03em] text-[var(--color-text)]">
              {score === null ? "--" : score}
            </span>
            <span className="text-sm font-semibold" style={{ color: classification.color }}>
              {classification.label}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {SUB_SCORE_META.map((item) => (
            <ScoreRow
              key={item.key}
              label={item.label}
              value={results?.[item.key] ?? 0}
              max={item.max}
              color={item.color}
            />
          ))}

          <div
            className="rounded-[var(--radius-md)] px-4 py-3 text-sm leading-6 [border:var(--border-default)]"
            style={{
              backgroundColor: classification.bg,
              borderColor: classification.color,
              color: classification.color,
            }}
          >
            {classification.recommendation}
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

function buildSitePrompt(results) {
  const regulatorySummary = [
    `${results.gridPolicyLabel} policy`,
    results.protectedArea ? "near protected area" : null,
    results.nearAirport ? "near airport" : null,
    `${results.permittingTimeMonths} months permitting`,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "Assess this solar project site:",
    `Location: ${results.city} (lat: ${results.lat.toFixed(4)}, lon: ${results.lon.toFixed(4)})`,
    `Solar resource: ${results.avgIrradiance.toFixed(2)} kWh/m2/day`,
    `System size: ${results.systemSizeMW.toFixed(1)} MW requiring ${results.landRequirement.toFixed(1)} hectares`,
    `Grid distance: ${results.gridDistanceKm} km (est. cost: ${formatCurrency(results.gridConnectionCost)})`,
    `Terrain: ${results.slopePercent}% slope, ${results.landTypeLabel}`,
    `Regulatory: ${regulatorySummary}`,
    `Site score: ${results.totalScore}/100 (${results.classification.label})`,
    `Sub-scores: Solar ${results.solarScore}/40, Grid ${results.gridScore}/25, Terrain ${results.terrainScore}/20, Regulatory ${results.regulatoryScore}/15`,
    "",
    "Provide 4-5 sentences covering:",
    "1. Overall site suitability verdict",
    "2. Strongest and weakest scoring factors",
    "3. Specific risk mitigation for the lowest scoring area",
    "4. Comparison to typical utility-scale solar project requirements",
    "5. Recommended system size given the land and grid constraints",
    "Be specific to the location and technical.",
  ].join("\n");
}

function buildSitePdfData(results, aiAnalysis) {
  return {
    inputs: {
      Location: results.city,
      Coordinates: `${results.lat.toFixed(4)}, ${results.lon.toFixed(4)}`,
      "System size": `${results.systemSizeMW.toFixed(1)} MW`,
      "Land type": results.landTypeLabel,
      "Grid distance": `${results.gridDistanceKm} km`,
      Slope: `${results.slopePercent}%`,
      "Panel efficiency": `${results.panelEfficiency.toFixed(1)}%`,
      "Protected area": results.protectedArea ? "Yes" : "No",
      "Near airport": results.nearAirport ? "Yes" : "No",
      "Grid policy": results.gridPolicyLabel,
      "Permitting time": `${results.permittingTimeMonths} months`,
    },
    metrics: [
      { label: "Site score", value: results.totalScore, unit: "/100" },
      { label: "Classification", value: results.classification.label, unit: "" },
      { label: "Land required", value: results.landRequirement.toFixed(1), unit: "ha" },
      {
        label: "Grid connection",
        value: `$${(results.gridConnectionCost / 1000).toFixed(0)}K`,
        unit: "",
      },
    ],
    monthlyData: [
      results.solarScore,
      results.gridScore,
      results.terrainScore,
      results.regulatoryScore,
    ],
    monthlyLabels: ["Solar (40)", "Grid (25)", "Terrain (20)", "Regulatory (15)"],
    aiAnalysis,
  };
}

export default function SiteAssessmentTool() {
  const [city, setCity] = useState("");
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [avgIrradiance, setAvgIrradiance] = useState(null);
  const [systemSizeMW, setSystemSizeMW] = useState(1);
  const [gridDistanceKm, setGridDistanceKm] = useState(5);
  const [slopePercent, setSlopePercent] = useState(3);
  const [landType, setLandType] = useState("flat_open");
  const [panelEfficiency, setPanelEfficiency] = useState(21);
  const [protectedArea, setProtectedArea] = useState(false);
  const [nearAirport, setNearAirport] = useState(false);
  const [gridPolicy, setGridPolicy] = useState("moderate");
  const [permittingTimeMonths, setPermittingTimeMonths] = useState(12);
  const [results, setResults] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [pdfData, setPdfData] = useState(null);

  const hasResults = Boolean(results);
  const liveLandRequirement = useMemo(
    () => calcLandRequirement(systemSizeMW, panelEfficiency),
    [systemSizeMW, panelEfficiency]
  );
  const liveGridCost = useMemo(
    () => estimateGridConnectionCost(gridDistanceKm, systemSizeMW),
    [gridDistanceKm, systemSizeMW]
  );

  const chartData = useMemo(
    () => ({
      labels: SUB_SCORE_META.map((item) => item.label),
      datasets: [
        {
          data: SUB_SCORE_META.map((item) => results?.[item.key] ?? 0),
          backgroundColor: SUB_SCORE_META.map((item) => item.color),
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    }),
    [results]
  );

  const scoreAccent = hasResults
    ? { bg: results.classification.bg, color: results.classification.color }
    : null;

  async function handleFetchSolarData() {
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
    setLat(null);
    setLon(null);
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

      const nextLat = Number.parseFloat(location.lat);
      const nextLon = Number.parseFloat(location.lon);

      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
        throw new Error("City not found. Try a different spelling.");
      }

      const irradianceResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${nextLat}&longitude=${nextLon}&start_date=2023-01-01&end_date=2023-12-31&daily=shortwave_radiation_sum&timezone=auto`
      );

      if (!irradianceResponse.ok) {
        throw new Error("Climate data unavailable for this location.");
      }

      const irradianceData = await irradianceResponse.json();
      const rawValues = irradianceData?.daily?.shortwave_radiation_sum;

      if (!Array.isArray(rawValues) || !rawValues.length) {
        throw new Error("Climate data unavailable for this location.");
      }

      const cleanValues = rawValues.map(Number).filter((value) => Number.isFinite(value));

      if (!cleanValues.length) {
        throw new Error("Climate data unavailable for this location.");
      }

      const averageIrradiance =
        cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;

      setLat(nextLat);
      setLon(nextLon);
      setAvgIrradiance(averageIrradiance);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to fetch solar data.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function buildResults() {
    if (!Number.isFinite(avgIrradiance) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Fetch solar data first.");
    }

    const solarScore = calcSolarScore(avgIrradiance);
    const gridScore = calcGridScore(gridDistanceKm);
    const terrainScore = calcTerrainScore(slopePercent, landType);
    const regulatoryScore = calcRegulatoryScore({
      protectedArea,
      nearAirport,
      gridPolicy,
      permittingTime: permittingTimeMonths,
    });
    const totalScore = calcSiteScore({
      solarScore,
      gridScore,
      terrainScore,
      regulatoryScore,
    });
    const classification = classifySite(totalScore);
    const landRequirement = calcLandRequirement(systemSizeMW, panelEfficiency);
    const gridConnectionCost = estimateGridConnectionCost(gridDistanceKm, systemSizeMW);

    if (!Number.isFinite(landRequirement) || !Number.isFinite(gridConnectionCost)) {
      throw new Error("Site assessment calculation failed.");
    }

    return {
      city: city.trim(),
      lat,
      lon,
      avgIrradiance,
      systemSizeMW,
      gridDistanceKm,
      slopePercent,
      landType,
      landTypeLabel: getLandTypeLabel(landType),
      panelEfficiency,
      protectedArea,
      nearAirport,
      gridPolicy,
      gridPolicyLabel: getGridPolicyLabel(gridPolicy),
      permittingTimeMonths,
      solarScore,
      gridScore,
      terrainScore,
      regulatoryScore,
      totalScore,
      classification,
      landRequirement,
      gridConnectionCost,
    };
  }

  async function handleAssessSite() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = buildResults();
      setResults(nextResults);
      const nextPdfData = buildSitePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.site,
        createToolReportSnapshot({
          toolName: "Site Assessment",
          inputs: {
            city: city.trim(),
            lat,
            lon,
            systemSizeMW,
            gridDistanceKm,
            slopePercent,
            landType,
            panelEfficiency,
            protectedArea,
            nearAirport,
            gridPolicy,
            permittingTimeMonths,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Site assessment calculation failed.");
      setResults(null);
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildSitePrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildSitePdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.site,
        createToolReportSnapshot({
          toolName: "Site Assessment",
          inputs: {
            city: city.trim(),
            lat,
            lon,
            systemSizeMW,
            gridDistanceKm,
            slopePercent,
            landType,
            panelEfficiency,
            protectedArea,
            nearAirport,
            gridPolicy,
            permittingTimeMonths,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildSitePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.site,
        createToolReportSnapshot({
          toolName: "Site Assessment",
          inputs: {
            city: city.trim(),
            lat,
            lon,
            systemSizeMW,
            gridDistanceKm,
            slopePercent,
            landType,
            panelEfficiency,
            protectedArea,
            nearAirport,
            gridPolicy,
            permittingTimeMonths,
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
          <Badge color="green">New tool</Badge>
          <Badge color="blue">Open-Meteo + Gemini</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Site Assessment
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Solar project site suitability scoring before detailed design - solar resource, grid
          access, terrain, and regulatory analysis with AI recommendations.
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
            <SectionLabel>Project location</SectionLabel>
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
                onClick={handleFetchSolarData}
                disabled={loadingLocation}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingLocation ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
                  />
                ) : null}
                <span>Fetch solar data</span>
              </button>
            </div>

            {loadingLocation ? (
              <LoadingIndicator message="Fetching coordinates and solar resource data..." />
            ) : null}

            {avgIrradiance !== null && lat !== null && lon !== null ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Avg irradiance: {formatNumber(avgIrradiance, 2)} kWh/m2/day
                  </p>
                  <Badge color="blue">Open-Meteo 2023</Badge>
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Coordinates: {lat.toFixed(4)}, {lon.toFixed(4)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <SectionLabel>Project size</SectionLabel>
            <div className="space-y-2">
              <SliderField
                label="System size"
                min={0.1}
                max={50}
                step={0.1}
                value={systemSizeMW}
                onChange={(event) => setSystemSizeMW(Number(event.target.value))}
                displayValue={`${systemSizeMW.toFixed(1)} MW`}
              />
              <p className="text-sm text-[var(--color-text-muted)]">
                Requires ~{formatNumber(liveLandRequirement, 1)} hectares
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <SectionLabel>Site characteristics</SectionLabel>
            <div className="space-y-2">
              <SliderField
                label="Grid distance"
                min={0}
                max={100}
                step={1}
                value={gridDistanceKm}
                onChange={(event) => setGridDistanceKm(Number(event.target.value))}
                displayValue={`${gridDistanceKm} km`}
              />
              <p className="text-sm text-[var(--color-text-muted)]">
                Est. grid connection: ~{formatCurrency(liveGridCost)}
              </p>
            </div>

            <SliderField
              label="Average slope"
              min={0}
              max={30}
              step={1}
              value={slopePercent}
              onChange={(event) => setSlopePercent(Number(event.target.value))}
              displayValue={`${slopePercent}%`}
            />

            <label className="flex flex-col gap-2">
              <SectionLabel>Land type</SectionLabel>
              <select
                value={landType}
                onChange={(event) => setLandType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {LAND_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <SliderField
              label="Panel efficiency"
              min={18}
              max={24}
              step={0.5}
              value={panelEfficiency}
              onChange={(event) => setPanelEfficiency(Number(event.target.value))}
              displayValue={`${panelEfficiency.toFixed(1)}%`}
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>Regulatory & grid</SectionLabel>

            <label className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
              <input
                type="checkbox"
                checked={protectedArea}
                onChange={(event) => setProtectedArea(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                Within 5km of protected nature area
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
              <input
                type="checkbox"
                checked={nearAirport}
                onChange={(event) => setNearAirport(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                Within 8km of airport (glare risk)
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <SectionLabel>Grid interconnection policy</SectionLabel>
              <select
                value={gridPolicy}
                onChange={(event) => setGridPolicy(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {GRID_POLICY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <SliderField
              label="Expected permitting time"
              min={3}
              max={36}
              step={1}
              value={permittingTimeMonths}
              onChange={(event) => setPermittingTimeMonths(Number(event.target.value))}
              displayValue={`${permittingTimeMonths} months`}
            />
          </div>

          <div className="space-y-3">
            <ActionButton
              onClick={handleAssessSite}
              loading={loadingLocation || loadingAI}
              variant="primary"
            >
              Assess site
            </ActionButton>
            {loadingAI ? (
              <LoadingIndicator message="AI is evaluating site suitability..." />
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Fetch solar data first, then assess the site for engineering suitability.
              </p>
            )}
          </div>
        </PanelCard>

        <div className="space-y-6">
          <ScoreGauge results={results} />

          <div className="grid gap-4 sm:grid-cols-2">
            <SiteMetricCard
              label="Site score"
              value={hasResults ? results.totalScore : "--"}
              unit="/100"
              accentStyle={scoreAccent}
            />
            <SiteMetricCard
              label="Land required"
              value={hasResults ? formatNumber(results.landRequirement, 1) : "--"}
              unit="ha"
            />
            <SiteMetricCard
              label="Grid connection cost"
              value={hasResults ? formatCurrency(results.gridConnectionCost) : "--"}
            />
            <SiteMetricCard
              label="Avg solar irradiance"
              value={hasResults ? formatNumber(results.avgIrradiance, 2) : "--"}
              unit="kWh/m2/day"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Sub-score breakdown</SectionLabel>
            <div className="h-[180px]">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4 bg-[var(--color-brand-light)]">
            <SectionLabel>Proceed to next step</SectionLabel>
            {hasResults ? (
              <>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--color-text)]">
                    Your site scored {results.totalScore}/100 ({results.classification.label}).
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Recommended next steps:
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {NEXT_STEP_TOOLS.map((tool) => {
                    const Icon = tool.Icon;

                    return (
                      <Link
                        key={tool.name}
                        href={tool.href}
                        className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/60 text-[var(--color-brand)] [border:var(--border-default)]">
                            <Icon className="h-5 w-5" />
                          </span>
                          <ArrowRightIcon className="mt-0.5 h-4 w-4 text-[var(--color-brand)]" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                          {tool.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                          {tool.description}
                        </p>
                      </Link>
                    );
                  })}
                  <ProjectReportCta
                    variant="card"
                    title="Generate Project Report"
                    description="Combine this site assessment with yield, design, finance, and ESG outputs in one PDF."
                  />
                </div>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Assess the site to unlock the recommended next tools for solar yield, shading, and
                grid connection design.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is evaluating site suitability..." />
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
                Assess the site to generate AI guidance on suitability, risks, and next design
                steps.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Site Assessment"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
        </div>
      </div>
    </section>
  );
}
