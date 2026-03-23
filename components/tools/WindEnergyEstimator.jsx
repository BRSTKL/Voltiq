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
import { calculateWindEnergy, WIND_TURBINES } from "../../lib/windCalc";

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
const MONTH_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];

const EMPTY_RESULTS = {
  avgScaledWind: null,
  annualKwh: null,
  annualMWh: null,
  capacityFactor: null,
  fullLoadHours: null,
  specificYield: null,
  monthlyProductionMWh: MONTH_LABELS.map(() => 0),
  monthlyAvgWindHub: MONTH_LABELS.map(() => 0),
  weibull: {
    lambda: null,
    k: null,
  },
  histogram: Array.from({ length: 26 }, (_, speed) => ({
    speed,
    hours: 0,
    inOperatingRange: false,
  })),
};

const monthlyChartOptions = {
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
        text: "MWh",
      },
    },
    windAxis: {
      type: "linear",
      position: "right",
      grid: {
        drawOnChartArea: false,
      },
      title: {
        display: true,
        text: "m/s",
      },
    },
  },
};

const histogramOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${formatNumber(context.parsed.y, 0)} h`;
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: "Wind speed (m/s)",
      },
      grid: {
        display: false,
      },
    },
    y: {
      title: {
        display: true,
        text: "Hours per year",
      },
      ticks: {
        callback(value) {
          return formatNumber(value, 0);
        },
      },
    },
  },
};

function average(values) {
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupByMonth(values) {
  const grouped = [];
  let cursor = 0;

  MONTH_HOURS.forEach((monthHours) => {
    grouped.push(values.slice(cursor, cursor + monthHours));
    cursor += monthHours;
  });

  return grouped;
}

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

function buildHighlightTokens(results) {
  const values = [
    results.avgScaledWind,
    results.annualMWh,
    results.capacityFactor,
    results.fullLoadHours,
    results.specificYield,
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

  if (results.capacityFactor !== null) {
    tokens.add(`${Number(results.capacityFactor.toFixed(1))}%`);
  }

  if (results.annualMWh !== null) {
    tokens.add(`${Number(results.annualMWh.toFixed(1))} MWh`);
  }

  if (results.fullLoadHours !== null) {
    tokens.add(`${Math.round(results.fullLoadHours)} h/year`);
  }

  return Array.from(tokens)
    .filter((token) => token && token !== "0" && token !== "0.0")
    .sort((first, second) => second.length - first.length);
}

function renderSummaryWithHighlights(text, results) {
  if (!text) {
    return null;
  }

  const tokens = buildHighlightTokens(results);

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

function buildWindSummary({ city, turbineName, numTurbines, hubHeight, results }) {
  const locationLabel = city.trim() || "the selected site";
  const avgWind = Number(results.avgScaledWind.toFixed(1));
  const capacityFactor = Number(results.capacityFactor.toFixed(1));
  const annualMWh = Number(results.annualMWh.toFixed(1));
  const fullLoadHours = Math.round(results.fullLoadHours);

  const resourceQuality =
    avgWind >= 8 ? "strong" : avgWind >= 6.5 ? "moderate" : "weak";

  const cfBenchmark =
    capacityFactor > 35 ? "good" : capacityFactor >= 25 ? "moderate" : "poor";

  let recommendation =
    "Optimization recommendation: validate turbine selection and test a higher hub height before locking the layout.";

  if (cfBenchmark === "poor") {
    recommendation =
      "Optimization recommendation: reconsider the turbine class, increase hub height, or reassess the site before procurement.";
  } else if (cfBenchmark === "good") {
    recommendation =
      "Optimization recommendation: optimize system losses and wake layout before procurement to preserve the strong wind resource.";
  }

  return [
    `For ${locationLabel}, the hub-height wind resource is ${resourceQuality}, with an average wind speed of ${avgWind} m/s at ${hubHeight} m and estimated annual production of ${annualMWh} MWh for ${turbineName} x${numTurbines}.`,
    `The ${capacityFactor}% capacity factor benchmarks as ${cfBenchmark}, delivering about ${fullLoadHours} h/year equivalent full-load operation with the selected turbine configuration.`,
    recommendation,
  ].join(" ");
}

function buildWindPdfData({
  city,
  turbineName,
  numTurbines,
  hubHeight,
  results,
  summary,
}) {
  return {
    inputs: {
      city: city.trim(),
      turbineModel: turbineName,
      numberOfTurbines: String(numTurbines),
      hubHeight: `${hubHeight} m`,
      avgWindSpeed: `${formatNumber(results.avgScaledWind, 1)} m/s`,
    },
    metrics: [
      { label: "Annual Production", value: formatNumber(results.annualMWh, 1), unit: "MWh/year" },
      { label: "Capacity Factor", value: formatNumber(results.capacityFactor, 1), unit: "%" },
      { label: "Full Load Hours", value: formatNumber(results.fullLoadHours, 0), unit: "h/year" },
      { label: "Specific Yield", value: formatNumber(results.specificYield, 0), unit: "kWh/kW" },
    ],
    monthlyData: results.monthlyProductionMWh.map((value) => Number(value.toFixed(2))),
    monthlyLabels: MONTH_LABELS,
    aiAnalysis: summary,
  };
}

export default function WindEnergyEstimator() {
  const [city, setCity] = useState("");
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingWind, setLoadingWind] = useState(false);
  const [hourlyWind10m, setHourlyWind10m] = useState([]);
  const [monthlyWind10m, setMonthlyWind10m] = useState([]);
  const [avgWind10m, setAvgWind10m] = useState(null);
  const [turbineKey, setTurbineKey] = useState("vestasV90");
  const [numTurbines, setNumTurbines] = useState(3);
  const [hubHeight, setHubHeight] = useState(80);
  const [alpha, setAlpha] = useState(0.143);
  const [losses, setLosses] = useState(8);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [pdfData, setPdfData] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const selectedTurbine = WIND_TURBINES[turbineKey];
  const isBusy = loadingLocation || loadingWind;
  const hasWindData = hourlyWind10m.length > 0;
  const hasResults = results.annualMWh !== null;

  const monthlyChartData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        type: "bar",
        label: "Production",
        data: hasResults
          ? results.monthlyProductionMWh.map((value) => Number(value.toFixed(2)))
          : MONTH_LABELS.map(() => 0),
        backgroundColor: "#1D9E75",
        borderRadius: 6,
        yAxisID: "productionAxis",
      },
      {
        type: "line",
        label: "Wind speed",
        data: hasResults
          ? results.monthlyAvgWindHub.map((value) => Number(value.toFixed(2)))
          : MONTH_LABELS.map(() => 0),
        borderColor: "#5DCAA5",
        backgroundColor: "#5DCAA5",
        pointBackgroundColor: "#5DCAA5",
        pointRadius: 2,
        pointHoverRadius: 3,
        tension: 0.3,
        yAxisID: "windAxis",
      },
    ],
  };

  const histogramBase = hasResults
    ? results.histogram
    : Array.from({ length: 26 }, (_, speed) => ({
        speed,
        hours: 0,
        inOperatingRange: speed >= selectedTurbine.cutIn && speed <= selectedTurbine.cutOut,
      }));

  const histogramData = {
    labels: histogramBase.map((entry) => entry.speed),
    datasets: [
      {
        label: "Hours",
        data: histogramBase.map((entry) => entry.hours),
        backgroundColor: histogramBase.map((entry) =>
          entry.inOperatingRange ? "#5DCAA5" : "#B4B2A9"
        ),
        borderRadius: 4,
      },
    ],
  };

  async function handleFetchWindData() {
    const query = city.trim();

    if (!query) {
      setError("Please enter a city name.");
      return;
    }

    setError("");
    setSummary("");
    setResults(EMPTY_RESULTS);
    setPdfData(null);
    setHourlyWind10m([]);
    setMonthlyWind10m([]);
    setAvgWind10m(null);
    setLat(null);
    setLon(null);
    setLoadingLocation(true);
    setLoadingWind(false);

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
      setLoadingWind(true);

      const windResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${nextLat}&longitude=${nextLon}&start_date=2023-01-01&end_date=2023-12-31&hourly=wind_speed_10m&wind_speed_unit=ms`
      );

      if (!windResponse.ok) {
        throw new Error("Wind data unavailable for this location.");
      }

      const windData = await windResponse.json();
      const values = windData?.hourly?.wind_speed_10m;

      if (!Array.isArray(values) || !values.length) {
        throw new Error("Wind data unavailable for this location.");
      }

      const cleanValues = values.map(Number).filter((value) => Number.isFinite(value));

      if (!cleanValues.length) {
        throw new Error("Wind data unavailable for this location.");
      }

      const groupedMonthly = groupByMonth(cleanValues);
      const monthlyAverages = groupedMonthly.map((monthValues) => average(monthValues));

      setHourlyWind10m(cleanValues);
      setMonthlyWind10m(monthlyAverages);
      setAvgWind10m(average(cleanValues));
    } catch (fetchError) {
      setError(
        locationResolved
          ? "Wind data unavailable for this location."
          : "City not found. Try a different spelling."
      );
    } finally {
      setLoadingLocation(false);
      setLoadingWind(false);
    }
  }

  function handleCalculate() {
    if (!hourlyWind10m.length) {
      setError("Fetch wind data first.");
      return;
    }

    setError("");
    setSummary("");
    setPdfData(null);

    try {
      const nextResults = calculateWindEnergy({
        hourlyWind10m,
        monthlyWind10m,
        turbine: selectedTurbine,
        numTurbines,
        hubHeight,
        alpha,
        losses,
      });

      setResults(nextResults);
      const nextSummary = buildWindSummary({
        city,
        turbineName: selectedTurbine.name,
        numTurbines,
        hubHeight,
        results: nextResults,
      });
      const nextPdfData = buildWindPdfData({
        city,
        turbineName: selectedTurbine.name,
        numTurbines,
        hubHeight,
        results: nextResults,
        summary: nextSummary,
      });

      setSummary(nextSummary);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.wind,
        createToolReportSnapshot({
          toolName: "Wind Energy Estimator",
          inputs: {
            city: city.trim(),
            turbineModel: selectedTurbine.name,
            numTurbines,
            hubHeight,
            alpha,
            losses,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: nextSummary,
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Wind energy calculation failed.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Wind Energy Estimator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Fetch a full year of wind data, scale it to hub height, and benchmark expected turbine
          performance.
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
            <SectionLabel>Location & wind resource</SectionLabel>
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
                onClick={handleFetchWindData}
                disabled={isBusy}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusy ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
                  />
                ) : null}
                <span>Fetch wind data</span>
              </button>
            </div>

            {loadingLocation ? <LoadingIndicator message={`Searching ${city.trim() || "location"}...`} /> : null}
            {!loadingLocation && loadingWind ? (
              <LoadingIndicator message="Fetching 8760 hours of wind data..." />
            ) : null}
            {!isBusy && lat !== null && lon !== null && avgWind10m !== null && hourlyWind10m.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Wind data loaded for {city.trim()} - avg {avgWind10m.toFixed(1)} m/s
              </p>
            ) : null}
          </div>

          {hasWindData ? (
            <>
              <div className="space-y-5">
                <label className="flex flex-col gap-2">
                  <SectionLabel>Turbine model</SectionLabel>
                  <select
                    value={turbineKey}
                    onChange={(event) => setTurbineKey(event.target.value)}
                    className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
                  >
                    {Object.values(WIND_TURBINES).map((turbine) => (
                      <option key={turbine.key} value={turbine.key}>
                        {turbine.name}
                      </option>
                    ))}
                  </select>
                </label>

                <SliderField
                  label="Number of turbines"
                  min={1}
                  max={10}
                  step={1}
                  value={numTurbines}
                  onChange={(event) => setNumTurbines(Number(event.target.value))}
                  displayValue={String(numTurbines)}
                />
                <SliderField
                  label="Hub height"
                  min={20}
                  max={150}
                  step={1}
                  value={hubHeight}
                  onChange={(event) => setHubHeight(Number(event.target.value))}
                  displayValue={`${hubHeight} m`}
                />
                <SliderField
                  label="Wind shear exponent a"
                  min={0.1}
                  max={0.3}
                  step={0.001}
                  value={alpha}
                  onChange={(event) => setAlpha(Number(event.target.value))}
                  displayValue={alpha.toFixed(3)}
                />
                <SliderField
                  label="System losses"
                  min={0}
                  max={20}
                  step={1}
                  value={losses}
                  onChange={(event) => setLosses(Number(event.target.value))}
                  displayValue={`${losses}%`}
                />
              </div>

              <div className="space-y-3">
                <ActionButton onClick={handleCalculate} variant="primary">
                  Calculate
                </ActionButton>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Wind data is loaded. Adjust turbine and hub assumptions, then calculate energy
                  yield and performance quality.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Fetch wind data first to unlock turbine selection and performance calculations.
            </p>
          )}
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Annual production"
              value={hasResults ? formatNumber(results.annualMWh, 1) : "--"}
              unit="MWh/year"
              accent
            />
            <MetricCard
              label="Capacity factor"
              value={hasResults ? formatNumber(results.capacityFactor, 1) : "--"}
              unit="%"
              accent
            />
            <MetricCard
              label="Full load hours"
              value={hasResults ? formatNumber(results.fullLoadHours, 0) : "--"}
              unit="h/year"
            />
            <MetricCard
              label="Specific yield"
              value={hasResults ? formatNumber(results.specificYield, 0) : "--"}
              unit="kWh/kW"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Monthly production</SectionLabel>
            <div className="h-[180px]">
              <Bar data={monthlyChartData} options={monthlyChartOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Wind speed histogram</SectionLabel>
            <div className="h-[140px]">
              <Bar data={histogramData} options={histogramOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Engineering summary</SectionLabel>
            {summary ? (
              <p className="text-sm leading-7 text-[var(--color-text)] whitespace-pre-line">
                {renderSummaryWithHighlights(summary, results)}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Fetch wind data and calculate to review the wind resource summary
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Wind Energy Estimator"
            data={pdfData}
            disabled={!hasResults || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
