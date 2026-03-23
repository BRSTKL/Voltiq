import { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
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
import { calculateShadingLoss } from "../../lib/shadingCalc";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const DEFAULT_OBSTACLES = [
  { id: 1, az: -55, elev: 18, width: 22 },
  { id: 2, az: 55, elev: 22, width: 28 },
];

const EMPTY_RESULTS = {
  annualShadingLoss: null,
  lostEnergy: null,
  netProduction: null,
  effectivePRDrop: null,
  monthlyLoss: [],
  monthlyData: Array.from({ length: 12 }, (_, index) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index],
    grossProduction: 0,
    lostProduction: 0,
    netProduction: 0,
  })),
  worstMonth: "",
  sunPaths: [],
};

const INVERTER_OPTIONS = {
  string: {
    label: "String inverter",
    multiplier: 1,
    impact:
      "String inverter behavior acts as the baseline, so shaded modules create a direct plant-level energy penalty.",
  },
  micro: {
    label: "Microinverter/Optimizer",
    multiplier: 0.4,
    impact:
      "Module-level electronics soften mismatch propagation, so the system absorbs shaded intervals with a smaller production penalty.",
  },
  central: {
    label: "Central inverter",
    multiplier: 1.3,
    impact:
      "Central inverter behavior amplifies mismatch impacts, so localized shading spreads into a larger system-wide loss.",
  },
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
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${formatNumber(context.parsed.y, 0)} kWh`;
        },
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: {
        display: false,
      },
    },
    y: {
      stacked: true,
      title: {
        display: true,
        text: "Annualized monthly energy (kWh)",
      },
      ticks: {
        callback(value) {
          return formatNumber(value, 0);
        },
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

function buildHighlightTokens(results) {
  const values = [
    results.annualShadingLoss,
    results.lostEnergy,
    results.netProduction,
    results.effectivePRDrop,
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

  if (results.annualShadingLoss !== null) {
    const annualLoss = Number(results.annualShadingLoss.toFixed(1));
    tokens.add(`${annualLoss}%`);
    tokens.add(`${Number(results.effectivePRDrop.toFixed(1))}%`);
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

function RedMetricCard({ label, value, unit }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-red-50 p-5 text-red-700 dark:bg-red-500/15 dark:text-red-200">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/75">{label}</p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="pb-1 text-sm font-medium text-current/75">{unit}</span> : null}
      </div>
    </div>
  );
}

function buildShadingSummary({ tilt, inverterType, results }) {
  const annualLoss = Number(results.annualShadingLoss.toFixed(1));
  const lostEnergy = Number(results.lostEnergy.toFixed(0));
  const netProduction = Number(results.netProduction.toFixed(0));
  const severity =
    annualLoss < 5 ? "minor" : annualLoss < 12 ? "moderate" : "severe";
  const inverter = INVERTER_OPTIONS[inverterType];

  let recommendation =
    "Mitigation recommendation: validate obstacle dimensions and trim obvious horizon obstructions before redesign.";

  if (severity === "moderate") {
    recommendation =
      inverterType === "micro"
        ? "Mitigation recommendation: prioritize pruning, relocation, and cleaner southern exposure because module-level electronics are already reducing mismatch losses."
        : "Mitigation recommendation: prioritize pruning or relocation and consider module-level electronics if not already selected.";
  } else if (severity === "severe") {
    recommendation =
      "Mitigation recommendation: rework array placement or tilt and clear the southern horizon before final layout freeze.";
  }

  return [
    `This scenario shows ${severity} shading, with ${annualLoss}% annual loss peaking in ${results.worstMonth} and removing about ${lostEnergy} kWh/year from the expected yield.`,
    `${inverter.label} is selected, so ${inverter.impact} Net annual production remains ${netProduction} kWh/year at the current ${tilt} deg tilt.`,
    recommendation,
  ].join(" ");
}

function buildShadingPdfData({ kWp, tilt, latitude, inverterType, obstacles, results, summary }) {
  return {
    inputs: {
      systemSize: `${kWp.toFixed(1)} kWp`,
      tiltAngle: `${tilt}\u00B0`,
      latitude: `${latitude}\u00B0N`,
      inverterType: INVERTER_OPTIONS[inverterType].label,
      obstacleCount: String(obstacles.length),
    },
    metrics: [
      { label: "Annual Shading Loss", value: formatNumber(results.annualShadingLoss, 1), unit: "%" },
      { label: "Lost Energy", value: formatNumber(results.lostEnergy, 0), unit: "kWh/year" },
      { label: "Net Production", value: formatNumber(results.netProduction, 0), unit: "kWh/year" },
      { label: "PR Drop", value: formatNumber(results.effectivePRDrop, 1), unit: "%" },
    ],
    monthlyData: results.monthlyLoss.map((value) => Number((value * 100).toFixed(1))),
    monthlyLabels: results.monthlyData.map((entry) => entry.month),
    aiAnalysis: summary,
  };
}

function drawSkyDiagram(canvas, geometry, obstacles) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const horizonY = height - 18;
  const radius = Math.min(width / 2 - 24, height - 28);
  const ringValues = [10, 20, 30, 40];

  function toCanvasPoint(azimuth, elevation) {
    const clampedAz = Math.max(-90, Math.min(90, azimuth));
    const clampedElevation = Math.max(0, Math.min(90, elevation));

    return {
      x: centerX + (clampedAz / 90) * radius,
      y: horizonY - (clampedElevation / 90) * radius,
    };
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = "transparent";
  context.fillRect(0, 0, width, height);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(94, 114, 108, 0.35)";

  ringValues.forEach((ring) => {
    const ringRadius = radius * (ring / 90);
    context.beginPath();
    context.arc(centerX, horizonY, ringRadius, Math.PI, 2 * Math.PI);
    context.stroke();
  });

  context.beginPath();
  context.arc(centerX, horizonY, radius, Math.PI, 2 * Math.PI);
  context.strokeStyle = "rgba(18, 33, 29, 0.28)";
  context.stroke();

  context.beginPath();
  context.moveTo(centerX - radius, horizonY);
  context.lineTo(centerX + radius, horizonY);
  context.strokeStyle = "rgba(18, 33, 29, 0.16)";
  context.stroke();

  context.fillStyle = "rgba(224,75,74,0.35)";
  obstacles.forEach((obstacle) => {
    const { x } = toCanvasPoint(obstacle.az, 0);
    const rx = Math.max((obstacle.width / 180) * radius, 8);
    const ry = Math.max((obstacle.elev / 90) * radius, 6);

    context.beginPath();
    context.ellipse(x, horizonY, rx, ry, 0, Math.PI, 2 * Math.PI);
    context.lineTo(x - rx, horizonY);
    context.closePath();
    context.fill();
  });

  context.strokeStyle = "#EF9F27";
  context.lineWidth = 1.6;
  geometry.sunPaths.forEach((path) => {
    context.beginPath();
    path.points.forEach((point, index) => {
      const { x, y } = toCanvasPoint(point.azimuth, point.elevation);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  });

  context.fillStyle = "rgba(94, 114, 108, 0.85)";
  context.font = '11px "Avenir Next", "Segoe UI", sans-serif';
  context.textAlign = "left";
  ringValues.forEach((ring) => {
    const y = horizonY - (ring / 90) * radius;
    context.fillText(`${ring}°`, centerX + 8, y - 2);
  });

  context.textAlign = "center";
  context.fillStyle = "rgba(18, 33, 29, 0.8)";
  context.fillText("E (-90°)", centerX - radius, horizonY + 14);
  context.fillText("S (0°)", centerX, horizonY + 14);
  context.fillText("W (+90°)", centerX + radius, horizonY + 14);
}

export default function ShadingLossAnalyzer() {
  const canvasRef = useRef(null);
  const obstacleIdRef = useRef(3);

  const [kWp, setKWp] = useState(10);
  const [tilt, setTilt] = useState(30);
  const [latitude, setLatitude] = useState(45);
  const [baseYield, setBaseYield] = useState(1350);
  const [inverterType, setInverterType] = useState("string");
  const [obstacles, setObstacles] = useState(DEFAULT_OBSTACLES);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [pdfData, setPdfData] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  let previewGeometry = EMPTY_RESULTS;

  try {
    previewGeometry = calculateShadingLoss({
      kWp,
      tilt,
      latitude,
      baseYield,
      inverterType,
      obstacles,
    });
  } catch (calculationError) {
    previewGeometry = EMPTY_RESULTS;
  }

  const hasResults = results.annualShadingLoss !== null;
  const monthlyData = hasResults ? results.monthlyData : EMPTY_RESULTS.monthlyData;
  const chartData = {
    labels: monthlyData.map((entry) => entry.month),
    datasets: [
      {
        label: "Net production",
        data: monthlyData.map((entry) => Number(entry.netProduction.toFixed(2))),
        backgroundColor: "#97C459",
        borderRadius: 6,
        stack: "energy",
      },
      {
        label: "Shading loss",
        data: monthlyData.map((entry) => Number(entry.lostProduction.toFixed(2))),
        backgroundColor: "#F09595",
        borderRadius: 6,
        stack: "energy",
      },
    ],
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    drawSkyDiagram(canvasRef.current, previewGeometry, obstacles);
  }, [previewGeometry, obstacles]);

  function updateObstacle(id, key, nextValue) {
    setObstacles((current) =>
      current.map((obstacle) =>
        obstacle.id === id ? { ...obstacle, [key]: Number(nextValue) } : obstacle
      )
    );
  }

  function addObstacle() {
    const nextId = obstacleIdRef.current;
    obstacleIdRef.current += 1;

    setObstacles((current) => [
      ...current,
      { id: nextId, az: 0, elev: 15, width: 20 },
    ]);
  }

  function removeObstacle(id) {
    setObstacles((current) => (current.length > 1 ? current.filter((obstacle) => obstacle.id !== id) : current));
  }

  function handleCalculate() {
    setError("");
    setSummary("");
    setPdfData(null);

    try {
      const nextResults = calculateShadingLoss({
        kWp,
        tilt,
        latitude,
        baseYield,
        inverterType,
        obstacles,
      });

      setResults(nextResults);
      const nextSummary = buildShadingSummary({
        tilt,
        inverterType,
        results: nextResults,
      });
      const nextPdfData = buildShadingPdfData({
        kWp,
        tilt,
        latitude,
        inverterType,
        obstacles,
        results: nextResults,
        summary: nextSummary,
      });

      setSummary(nextSummary);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.shading,
        createToolReportSnapshot({
          toolName: "Shading Loss Analyzer",
          inputs: {
            kWp,
            tilt,
            latitude,
            inverterType,
            obstacles,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: nextSummary,
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Shading calculation failed.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Shading Loss Analyzer
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Estimate obstacle-driven shading losses, compare inverter response, and review the sky
          geometry behind the annual production penalty.
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
              label="System size"
              min={1}
              max={50}
              step={0.5}
              value={kWp}
              onChange={(event) => setKWp(Number(event.target.value))}
              displayValue={`${kWp.toFixed(1)} kWp`}
            />
            <SliderField
              label="Panel tilt"
              min={0}
              max={60}
              step={1}
              value={tilt}
              onChange={(event) => setTilt(Number(event.target.value))}
              displayValue={`${tilt} deg`}
            />
            <SliderField
              label="Latitude"
              min={36}
              max={55}
              step={1}
              value={latitude}
              onChange={(event) => setLatitude(Number(event.target.value))}
              displayValue={`${latitude} degN`}
            />
            <SliderField
              label="Base specific yield"
              min={800}
              max={1800}
              step={50}
              value={baseYield}
              onChange={(event) => setBaseYield(Number(event.target.value))}
              displayValue={`${baseYield} kWh/kWp`}
            />

            <label className="flex flex-col gap-2">
              <SectionLabel>Inverter type</SectionLabel>
              <select
                value={inverterType}
                onChange={(event) => setInverterType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="string">String inverter</option>
                <option value="micro">Microinverter/Optimizer</option>
                <option value="central">Central inverter</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Obstacle list</SectionLabel>
              <button
                type="button"
                onClick={addObstacle}
                className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
              >
                Add obstacle
              </button>
            </div>

            <div className="space-y-3">
              {obstacles.map((obstacle, index) => (
                <div
                  key={obstacle.id}
                  className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-3 [border:var(--border-default)] sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      Azimuth {index + 1}
                    </span>
                    <input
                      type="number"
                      min={-90}
                      max={90}
                      value={obstacle.az}
                      onChange={(event) => updateObstacle(obstacle.id, "az", event.target.value)}
                      className="min-h-[44px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      Elevation
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={obstacle.elev}
                      onChange={(event) => updateObstacle(obstacle.id, "elev", event.target.value)}
                      className="min-h-[44px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      Width
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={180}
                      value={obstacle.width}
                      onChange={(event) => updateObstacle(obstacle.id, "width", event.target.value)}
                      className="min-h-[44px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeObstacle(obstacle.id)}
                    disabled={obstacles.length === 1}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <p className="text-sm text-[var(--color-text-muted)]">
              Negative azimuth values represent east-facing obstacles, positive values represent
              west-facing obstacles, and 0 deg is due south.
            </p>
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} variant="primary">
              Calculate
            </ActionButton>
            <p className="text-sm text-[var(--color-text-muted)]">
              Review annual loss severity, monthly shading distribution, and the visual sky
              obstruction profile for the current geometry.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <RedMetricCard
              label="Shading loss"
              value={hasResults ? formatNumber(results.annualShadingLoss, 1) : "--"}
              unit="%"
            />
            <RedMetricCard
              label="Lost energy"
              value={hasResults ? formatNumber(results.lostEnergy, 0) : "--"}
              unit="kWh/year"
            />
            <MetricCard
              label="Net production"
              value={hasResults ? formatNumber(results.netProduction, 0) : "--"}
              unit="kWh/year"
            />
            <MetricCard
              label="Effective PR drop"
              value={hasResults ? formatNumber(results.effectivePRDrop, 1) : "--"}
              unit="%"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Sky diagram</SectionLabel>
            <div className="overflow-x-auto">
              <canvas
                ref={canvasRef}
                width={400}
                height={160}
                className="h-auto w-full max-w-[400px] rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]"
              />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Monthly shading impact</SectionLabel>
            <div className="h-[180px]">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Engineering summary</SectionLabel>
            {summary ? (
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                {renderSummaryWithHighlights(summary, results)}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Adjust the geometry and calculate to review the shading summary
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Shading Loss Analyzer"
            data={pdfData}
            disabled={!hasResults || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
