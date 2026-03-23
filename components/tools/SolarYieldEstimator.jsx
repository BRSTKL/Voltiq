import { useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  BarController,
  CategoryScale,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
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
import { calculateSolarYield } from "../../lib/solarCalc";

ChartJS.register(
  BarElement,
  BarController,
  CategoryScale,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMPTY_MONTHLY_DATA = MONTH_LABELS.map((month) => ({
  month,
  irradiance: 0,
  production: 0,
}));

const EMPTY_RESULTS = {
  annualYield: null,
  specificYield: null,
  co2Saved: null,
  monthlyData: EMPTY_MONTHLY_DATA,
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      position: "top",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
      },
    },
  },
  scales: {
    productionAxis: {
      type: "linear",
      position: "left",
      title: {
        display: true,
        text: "kWh production",
      },
    },
    irradianceAxis: {
      type: "linear",
      position: "right",
      grid: {
        drawOnChartArea: false,
      },
      title: {
        display: true,
        text: "kWh/m^2 irradiance",
      },
    },
  },
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

function buildHighlightTokens(results, PR) {
  const values = [
    results.annualYield,
    results.specificYield,
    results.co2Saved,
    PR * 100,
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

  const prPercentage = Number((PR * 100).toFixed(0));
  tokens.add(`${prPercentage}%`);
  tokens.add(`${prPercentage.toLocaleString("en-US")}%`);

  return Array.from(tokens)
    .filter((token) => token && token !== "0" && token !== "0.0")
    .sort((first, second) => second.length - first.length);
}

function renderAnalysisWithHighlights(text, results, PR) {
  if (!text) {
    return null;
  }

  const tokens = buildHighlightTokens(results, PR);

  if (!tokens.length) {
    return text;
  }

  const matcher = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "g");
  const tokenSet = new Set(tokens);

  return text.split(matcher).map((part, index) =>
    tokenSet.has(part) ? <strong key={`${part}-${index}`}>{part}</strong> : part
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

function buildSolarSummary({ city, kWp, tilt, azimuth, systemType, PR, results }) {
  const locationLabel = city.trim() || "the selected site";
  const prPercentage = Math.round(PR * 100);
  const tiltDeviation = Math.abs(tilt - 30);
  const azimuthDeviation = Math.abs(azimuth);

  let orientationNote = "well aligned with the modelled optimum.";

  if (tiltDeviation > 12 || azimuthDeviation > 25) {
    orientationNote = "likely to incur a noticeable orientation penalty relative to the modelled optimum.";
  } else if (tiltDeviation > 5 || azimuthDeviation > 10) {
    orientationNote = "acceptable, but there is still measurable room for orientation improvement.";
  }

  const operatingNote =
    systemType === "Hybrid"
      ? "Hybrid operation will benefit from careful inverter and battery dispatch coordination."
      : systemType === "Standalone"
        ? "Standalone operation should be checked against storage and seasonal resilience assumptions."
        : "Grid-connected operation is well suited to capturing the available annual production profile.";

  const recommendation =
    tiltDeviation > 5 || azimuthDeviation > 10
      ? "Optimization recommendation: move the array closer to 30 deg tilt and a south-facing azimuth where site constraints allow."
      : prPercentage < 82
        ? "Optimization recommendation: focus on inverter matching, DC wiring losses, and soiling control to lift the effective performance ratio."
        : "Optimization recommendation: validate shading margins and row spacing with a site-specific layout study before final design freeze.";

  return [
    `For ${locationLabel}, the ${kWp.toFixed(1)} kWp ${systemType.toLowerCase()} PV system is estimated to produce ${Number(results.annualYield.toFixed(0))} kWh/year, with a specific yield of ${Number(results.specificYield.toFixed(1))} kWh/kWp.`,
    `A ${tilt} deg tilt, ${azimuth} deg azimuth, and ${prPercentage}% performance ratio leave the array ${orientationNote}`,
    `${operatingNote} The current model indicates approximately ${Number(results.co2Saved.toFixed(0))} kg/year of avoided CO2 emissions.`,
    recommendation,
  ].join(" ");
}

function formatSolarAzimuth(azimuth) {
  if (azimuth === 0) {
    return "0\u00B0 (South)";
  }

  if (azimuth < 0) {
    return `${azimuth}\u00B0 (East of south)`;
  }

  return `${azimuth}\u00B0 (West of south)`;
}

function buildSolarPdfData({ city, kWp, tilt, azimuth, PR, systemType, results, summary }) {
  return {
    inputs: {
      city: city.trim(),
      systemSize: `${kWp.toFixed(1)} kWp`,
      tiltAngle: `${tilt}\u00B0`,
      azimuth: formatSolarAzimuth(azimuth),
      performanceRatio: `${Math.round(PR * 100)}%`,
      systemType,
    },
    metrics: [
      { label: "Annual Yield", value: formatNumber(results.annualYield, 0), unit: "kWh/year" },
      { label: "Specific Yield", value: formatNumber(results.specificYield, 1), unit: "kWh/kWp" },
      { label: "Performance Ratio", value: formatNumber(PR * 100, 0), unit: "%" },
      { label: "CO2 Saved", value: formatNumber(results.co2Saved, 0), unit: "kg/year" },
    ],
    monthlyData: results.monthlyData.map((entry) => Number(entry.production.toFixed(2))),
    monthlyLabels: results.monthlyData.map((entry) => entry.month),
    aiAnalysis: summary,
  };
}

export default function SolarYieldEstimator() {
  const [city, setCity] = useState("");
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [kWp, setKWp] = useState(10);
  const [tilt, setTilt] = useState(30);
  const [azimuth, setAzimuth] = useState(0);
  const [PR, setPR] = useState(0.8);
  const [systemType, setSystemType] = useState("Grid-connected");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingClimate, setLoadingClimate] = useState(false);
  const [dailyIrradiance, setDailyIrradiance] = useState([]);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [pdfData, setPdfData] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const isBusy = loadingLocation || loadingClimate;
  const hasResults = results.annualYield !== null;
  const monthlyData = results.monthlyData?.length ? results.monthlyData : EMPTY_MONTHLY_DATA;

  const chartData = {
    labels: monthlyData.map((entry) => entry.month),
    datasets: [
      {
        type: "bar",
        label: "Production",
        data: monthlyData.map((entry) => Number(entry.production.toFixed(2))),
        backgroundColor: "#97C459",
        borderRadius: 6,
        yAxisID: "productionAxis",
      },
      {
        type: "line",
        label: "Irradiance",
        data: monthlyData.map((entry) => Number(entry.irradiance.toFixed(2))),
        borderColor: "#1D9E75",
        backgroundColor: "#1D9E75",
        pointBackgroundColor: "#1D9E75",
        pointRadius: 2,
        pointHoverRadius: 3,
        tension: 0.32,
        yAxisID: "irradianceAxis",
      },
    ],
  };

  async function handleFetchData() {
    const query = city.trim();

    if (!query) {
      setError("Please enter a city name.");
      return;
    }

    setError("");
    setSummary("");
    setResults(EMPTY_RESULTS);
    setPdfData(null);
    setDailyIrradiance([]);
    setLat(null);
    setLon(null);
    setLoadingLocation(true);
    setLoadingClimate(false);

    let locationResolved = false;

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

      locationResolved = true;
      setLat(nextLat);
      setLon(nextLon);
      setLoadingLocation(false);
      setLoadingClimate(true);

      const climateResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${nextLat}&longitude=${nextLon}&start_date=2023-01-01&end_date=2023-12-31&daily=shortwave_radiation_sum&timezone=auto`
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

      setDailyIrradiance(cleanValues);
    } catch (fetchError) {
      setError(
        locationResolved
          ? "Climate data unavailable for this location."
          : "City not found. Try a different spelling."
      );
    } finally {
      setLoadingLocation(false);
      setLoadingClimate(false);
    }
  }

  async function handleCalculateAndAnalyze() {
    if (!dailyIrradiance.length) {
      setError("Fetch climate data first.");
      return;
    }

    setError("");
    setSummary("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = calculateSolarYield({
        dailyIrradiance,
        kWp,
        tilt,
        azimuth,
        PR,
      });
      setResults(nextResults);
    } catch (calculationError) {
      setError("Climate data unavailable for this location.");
      return;
    }

    const nextSummary = buildSolarSummary({
      city,
      kWp,
      tilt,
      azimuth,
      systemType,
      PR,
      results: nextResults,
    });

    setSummary(nextSummary);
    const nextPdfData = buildSolarPdfData({
      city,
      kWp,
      tilt,
      azimuth,
      PR,
      systemType,
      results: nextResults,
      summary: nextSummary,
    });
    setPdfData(nextPdfData);
    saveToolReportResult(
      REPORT_STORAGE_KEYS.solar,
      createToolReportSnapshot({
        toolName: "Solar Yield Estimator",
        inputs: {
          city: city.trim(),
          kWp,
          tilt,
          azimuth,
          PR,
          systemType,
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
          Solar Yield Estimator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Fetch location climate data, calculate annual production, and review an engineering
          summary.
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
            <SectionLabel>Location & climate</SectionLabel>
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
                onClick={handleFetchData}
                disabled={loadingLocation || loadingClimate}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingLocation || loadingClimate ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
                  />
                ) : null}
                <span>Fetch data</span>
              </button>
            </div>
            {loadingLocation ? <LoadingIndicator message="Searching location..." /> : null}
            {!loadingLocation && loadingClimate ? (
              <LoadingIndicator message="Fetching climate data..." />
            ) : null}
            {!loadingLocation && !loadingClimate && lat !== null && lon !== null && dailyIrradiance.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Coordinates: {lat.toFixed(3)}, {lon.toFixed(3)}. Loaded {dailyIrradiance.length} daily
                irradiance values for 2023.
              </p>
            ) : null}
          </div>

          <div className="space-y-5">
            <SliderField
              label="System size"
              min={1}
              max={100}
              step={0.5}
              value={kWp}
              onChange={(event) => setKWp(Number(event.target.value))}
              displayValue={`${kWp.toFixed(1)} kWp`}
            />
            <SliderField
              label="Tilt angle"
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
            <SliderField
              label="Performance ratio"
              min={0.6}
              max={0.9}
              step={0.01}
              value={PR}
              onChange={(event) => setPR(Number(event.target.value))}
              displayValue={PR.toFixed(2)}
            />

            <label className="flex flex-col gap-2">
              <SectionLabel>System type</SectionLabel>
              <select
                value={systemType}
                onChange={(event) => setSystemType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option>Grid-connected</option>
                <option>Standalone</option>
                <option>Hybrid</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculateAndAnalyze} loading={isBusy} variant="primary">
              Calculate
            </ActionButton>
            <p className="text-sm text-[var(--color-text-muted)]">
              Fetch climate data first, then calculate production and review the engineering summary.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Annual yield"
              value={hasResults ? formatNumber(results.annualYield, 0) : "--"}
              unit="kWh/year"
              accent
            />
            <MetricCard
              label="Performance ratio"
              value={formatNumber(PR * 100, 0)}
              unit="%"
            />
            <MetricCard
              label="Specific yield"
              value={hasResults ? formatNumber(results.specificYield, 1) : "--"}
              unit="kWh/kWp"
            />
            <MetricCard
              label="CO2 saved"
              value={hasResults ? formatNumber(results.co2Saved, 0) : "--"}
              unit="kg/year"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Monthly production</SectionLabel>
            <div className="h-[200px]">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Engineering summary</SectionLabel>
            {summary ? (
              <p className="text-sm leading-7 text-[var(--color-text)] whitespace-pre-line">
                {renderAnalysisWithHighlights(summary, results, PR)}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Enter city and calculate to get a system summary
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Solar Yield Estimator"
            data={pdfData}
            disabled={!hasResults || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
