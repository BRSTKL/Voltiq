import { useMemo, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import {
  BoltIcon,
  CubeTransparentIcon,
  CurrencyDollarIcon,
  PaperAirplaneIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { Bar, Line } from "react-chartjs-2";
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
import { calcLCOE, calcSensitivityCF, TECH_DEFAULTS } from "../../lib/lcoeCalc";

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

const TECH_ORDER = [
  "solar_utility",
  "onshore_wind",
  "offshore_wind",
  "natural_gas",
  "nuclear",
];

const CAPEX_RANGES = {
  solar_utility: { min: 400, max: 2000, step: 50 },
  onshore_wind: { min: 800, max: 2500, step: 50 },
  offshore_wind: { min: 2000, max: 6000, step: 50 },
  natural_gas: { min: 500, max: 1500, step: 50 },
  nuclear: { min: 3000, max: 12000, step: 50 },
};

const PRESET_CONFIG = {
  conservative: { label: "Conservative", discountRate: 10, carbonCostPerTon: 0 },
  "base-case": { label: "Base case", discountRate: 8, carbonCostPerTon: 65 },
  "green-transition": { label: "Green transition", discountRate: 6, carbonCostPerTon: 130 },
};

const BREAKDOWN_META = [
  { key: "capex", label: "CAPEX", color: "#085041" },
  { key: "fixedOpex", label: "Fixed O&M", color: "#1D9E75" },
  { key: "variableOpex", label: "Variable O&M", color: "#5DCAA5" },
  { key: "fuel", label: "Fuel", color: "#888780" },
  { key: "carbon", label: "Carbon", color: "#F09595" },
];

const PROJECTION_DATA = [
  { name: "Solar PV", current: 45, future: 28, change: "-38%" },
  { name: "Onshore Wind", current: 65, future: 48, change: "-26%" },
  { name: "Offshore Wind", current: 95, future: 65, change: "-32%" },
];

const SENSITIVITY_CF_RANGE = Array.from({ length: 18 }, (_, index) => 10 + index * 5);

const barValueLabelPlugin = {
  id: "barValueLabelPlugin",
  afterDatasetsDraw(chart, args, pluginOptions) {
    if (!pluginOptions?.enabled) {
      return;
    }

    const datasetIndex = pluginOptions.datasetIndex ?? 0;
    const dataset = chart.data.datasets?.[datasetIndex];
    const meta = chart.getDatasetMeta(datasetIndex);

    if (!dataset || !meta?.data?.length) {
      return;
    }

    const { chartArea, ctx } = chart;
    ctx.save();
    ctx.fillStyle = "#1C2422";
    ctx.font = '600 11px "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = "middle";

    meta.data.forEach((element, index) => {
      const label = `$${Math.round(Number(dataset.data[index] ?? 0))}`;
      const width = ctx.measureText(label).width;
      const outsideX = element.x + 8;
      const canDrawOutside = outsideX + width <= chartArea.right - 6;

      ctx.textAlign = canDrawOutside ? "left" : "right";
      ctx.fillText(label, canDrawOutside ? outsideX : element.x - 8, element.y);
    });

    ctx.restore();
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

function formatCurrency(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `$${formatNumber(value, maximumFractionDigits)}`;
}

function formatEmissions(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(value < 0.1 ? 3 : 2);
}

function createDefaultParams() {
  return TECH_ORDER.reduce((accumulator, key) => {
    accumulator[key] = {
      ...TECH_DEFAULTS[key],
      active: true,
    };
    return accumulator;
  }, {});
}

function clampCapacityFactor(value) {
  return Math.max(10, Math.min(95, value));
}

function getTechnologyIcon(icon) {
  if (icon === "solar") {
    return SunIcon;
  }

  if (icon === "wind" || icon === "offshore") {
    return PaperAirplaneIcon;
  }

  if (icon === "gas") {
    return BoltIcon;
  }

  if (icon === "nuclear") {
    return CubeTransparentIcon;
  }

  return CurrencyDollarIcon;
}

function buildTechnologyResult(key, technology, globalParams) {
  const calculation = calcLCOE({
    capexPerKw: technology.capexPerKw,
    fixedOpexPerKwYear: technology.fixedOpexPerKwYear,
    variableOpexPerMwh: technology.variableOpexPerMwh,
    fuelCostPerMwh: technology.fuelCostPerMwh,
    capacityFactor: technology.capacityFactor,
    discountRate: globalParams.discountRate,
    projectLifeYears: technology.projectLifeYears,
    carbonCostPerTon: globalParams.carbonCostPerTon,
    emissionsFactor: technology.emissionsFactor,
  });

  return {
    key,
    ...technology,
    lcoe: calculation.total,
    breakdown: calculation.breakdown,
  };
}

function buildComparisonResults(params, globalParams) {
  const calculatedTechnologies = TECH_ORDER.map((key) =>
    buildTechnologyResult(key, params[key], globalParams)
  );
  const activeTechs = calculatedTechnologies
    .filter((technology) => technology.active)
    .sort((left, right) => left.lcoe - right.lcoe);

  if (activeTechs.length < 2) {
    throw new Error("Keep at least two technologies active for comparison.");
  }

  return {
    activeTechs,
    calculatedTechnologies,
    cheapest: activeTechs[0],
    mostExpensive: activeTechs[activeTechs.length - 1],
    sensitivitySeries: activeTechs.map((technology) => ({
      key: technology.key,
      name: technology.name,
      color: technology.color,
      colorDark: technology.colorDark,
      currentCf: technology.capacityFactor,
      points: calcSensitivityCF(
        {
          capexPerKw: technology.capexPerKw,
          fixedOpexPerKwYear: technology.fixedOpexPerKwYear,
          variableOpexPerMwh: technology.variableOpexPerMwh,
          fuelCostPerMwh: technology.fuelCostPerMwh,
          capacityFactor: technology.capacityFactor,
          discountRate: globalParams.discountRate,
          projectLifeYears: technology.projectLifeYears,
          carbonCostPerTon: globalParams.carbonCostPerTon,
          emissionsFactor: technology.emissionsFactor,
        },
        SENSITIVITY_CF_RANGE
      ).map((entry) => ({
        x: entry.cf,
        y: Number(entry.lcoe.toFixed(2)),
      })),
    })),
  };
}

function buildLcoePrompt(results, globalParams) {
  return `Analyze this LCOE comparison for electricity generation:
Discount rate: ${globalParams.discountRate}%, Carbon price: $${globalParams.carbonCostPerTon}/tCO2

Results ($/MWh):
${results.activeTechs
  .map(
    (technology) => `${technology.name}: $${technology.lcoe.toFixed(0)}/MWh
   (CAPEX: $${technology.breakdown.capex.toFixed(0)},
    O&M: $${technology.breakdown.fixedOpex.toFixed(0)},
    Fuel: $${technology.breakdown.fuel.toFixed(0)},
    Carbon: $${technology.breakdown.carbon.toFixed(0)})`
  )
  .join("\n")}

Cheapest technology: ${results.cheapest.name} at $${results.cheapest.lcoe.toFixed(0)}/MWh
Most expensive: ${results.mostExpensive.name} at $${results.mostExpensive.lcoe.toFixed(0)}/MWh

Provide 4-5 sentences covering:
1. Which technology offers best value and why
2. Impact of the carbon price on fossil fuel competitiveness
3. How discount rate affects capital-intensive vs fuel-heavy plants
4. Key assumption that most influences the ranking
5. One scenario where the ranking would change
   (e.g. higher gas prices, lower solar CAPEX)
Be analytical, reference real market context from 2024-2025.`;
}

function buildLcoePdfData(results, globalParams, activePreset, aiAnalysis) {
  const gasTechnology = results.calculatedTechnologies.find(
    (technology) => technology.key === "natural_gas"
  );
  const scenarioLabel = PRESET_CONFIG[activePreset]?.label || "Custom";
  const cheapestLcoe = results.cheapest.lcoe;
  const highestLcoe = results.mostExpensive.lcoe;

  return {
    inputs: {
      "Discount rate": `${globalParams.discountRate}%`,
      "Carbon price": `$${globalParams.carbonCostPerTon}/tCO2`,
      "Active technologies": results.activeTechs.map((technology) => technology.name).join(", "),
      Scenario: scenarioLabel,
    },
    metrics: [
      {
        label: "Cheapest source",
        value: results.cheapest.name,
        unit: `$${cheapestLcoe.toFixed(0)}/MWh`,
      },
      {
        label: "Most expensive",
        value: results.mostExpensive.name,
        unit: `$${highestLcoe.toFixed(0)}/MWh`,
      },
      {
        label: "LCOE spread",
        value: (highestLcoe - cheapestLcoe).toFixed(0),
        unit: "$/MWh",
      },
      {
        label: "Carbon impact on gas",
        value: gasTechnology ? gasTechnology.breakdown.carbon.toFixed(0) : "0",
        unit: "$/MWh added",
      },
    ],
    monthlyData: results.activeTechs.map((technology) => Math.round(technology.lcoe)),
    monthlyLabels: results.activeTechs.map((technology) => technology.name.slice(0, 10)),
    aiAnalysis,
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

function CompactSliderField({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  displayValue,
}) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="h-2 w-full flex-1 cursor-pointer accent-[var(--color-brand)]"
        />
        <span className="min-w-[4.75rem] text-right text-xs font-semibold tabular-nums text-[var(--color-text)]">
          {displayValue ?? value}
        </span>
      </div>
    </label>
  );
}

function PresetButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[40px] rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold transition-colors duration-200",
        active
          ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
          : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)]"
      )}
    >
      {children}
    </button>
  );
}

function LcoeMetricCard({ label, value, unit, accent = false }) {
  const wrapperClasses = accent
    ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
    : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]";
  const metaClasses = accent ? "text-white/75" : "text-[var(--color-text-muted)]";

  return (
    <div className={cn("rounded-[var(--radius-lg)] p-5", wrapperClasses)}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", metaClasses)}>
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className={cn("pb-1 text-sm font-medium", metaClasses)}>{unit}</span> : null}
      </div>
    </div>
  );
}

function TechnologyCard({
  technology,
  capexRange,
  previewValue,
  activeCount,
  discountRate,
  onToggle,
  onFieldChange,
  onReset,
}) {
  const Icon = getTechnologyIcon(technology.icon);
  const disableToggle = technology.active && activeCount <= 2;

  return (
    <PanelCard
      className={cn("space-y-4 border-t-4 transition-opacity", !technology.active && "opacity-40")}
      style={{ borderTopColor: technology.color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: `${technology.color}22`, color: technology.colorDark }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">{technology.name}</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              WACC {discountRate.toFixed(1)}%
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={technology.active}
            onChange={() => onToggle(technology.key)}
            disabled={disableToggle}
            className="h-4 w-4 accent-[var(--color-brand)] disabled:cursor-not-allowed"
          />
          Active
        </label>
      </div>

      <div className="space-y-3">
        <CompactSliderField
          label="CAPEX"
          min={capexRange.min}
          max={capexRange.max}
          step={capexRange.step}
          value={technology.capexPerKw}
          onChange={(event) =>
            onFieldChange(technology.key, "capexPerKw", Number(event.target.value))
          }
          displayValue={`${formatCurrency(technology.capexPerKw, 0)}/kW`}
        />
        <CompactSliderField
          label="Fixed O&M"
          min={5}
          max={200}
          step={1}
          value={technology.fixedOpexPerKwYear}
          onChange={(event) =>
            onFieldChange(technology.key, "fixedOpexPerKwYear", Number(event.target.value))
          }
          displayValue={`${formatCurrency(technology.fixedOpexPerKwYear, 0)}/kW`}
        />
        <CompactSliderField
          label="Capacity factor"
          min={5}
          max={95}
          step={1}
          value={technology.capacityFactor}
          onChange={(event) =>
            onFieldChange(technology.key, "capacityFactor", Number(event.target.value))
          }
          displayValue={`${technology.capacityFactor}%`}
        />
        <CompactSliderField
          label="Project life"
          min={10}
          max={60}
          step={5}
          value={technology.projectLifeYears}
          onChange={(event) =>
            onFieldChange(technology.key, "projectLifeYears", Number(event.target.value))
          }
          displayValue={`${technology.projectLifeYears}y`}
        />
        {technology.key === "natural_gas" || technology.key === "nuclear" ? (
          <CompactSliderField
            label="Fuel cost"
            min={0}
            max={120}
            step={1}
            value={technology.fuelCostPerMwh}
            onChange={(event) =>
              onFieldChange(technology.key, "fuelCostPerMwh", Number(event.target.value))
            }
            displayValue={`${formatCurrency(technology.fuelCostPerMwh, 0)}/MWh`}
          />
        ) : null}
        <CompactSliderField
          label="Emissions factor"
          min={0}
          max={1}
          step={0.01}
          value={technology.emissionsFactor}
          onChange={(event) =>
            onFieldChange(technology.key, "emissionsFactor", Number(event.target.value))
          }
          displayValue={`${formatEmissions(technology.emissionsFactor)} t`}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/0 pt-3 [border-top:var(--border-default)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          Current LCOE:{" "}
          <span className="font-semibold text-[var(--color-text)]">
            ~{formatCurrency(previewValue, 0)}/MWh
          </span>
        </p>
        <button
          type="button"
          onClick={() => onReset(technology.key)}
          className="text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 hover:text-[var(--color-brand-dark)]"
        >
          Reset to defaults
        </button>
      </div>
    </PanelCard>
  );
}

export default function LCOEComparator() {
  const [params, setParams] = useState(createDefaultParams);
  const [globalParams, setGlobalParams] = useState({ discountRate: 8, carbonCostPerTon: 0 });
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("inputs");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [pdfData, setPdfData] = useState(null);
  const [activePreset, setActivePreset] = useState("custom");

  const previewResults = useMemo(
    () =>
      TECH_ORDER.reduce((accumulator, key) => {
        try {
          accumulator[key] = buildTechnologyResult(key, params[key], globalParams);
        } catch {
          accumulator[key] = null;
        }
        return accumulator;
      }, {}),
    [globalParams, params]
  );

  const activeCount = TECH_ORDER.filter((key) => params[key].active).length;
  const hasResults = Boolean(results);
  const gasCarbon = previewResults.natural_gas?.breakdown.carbon ?? 0;
  const nuclearCarbon = previewResults.nuclear?.breakdown.carbon ?? 0;

  function applyLocalResults(nextParams, nextGlobalParams, nextPreset = "custom") {
    if (!results) {
      setAiAnalysis("");
      setPdfData(null);
      setError("");
      setActivePreset(nextPreset);
      return;
    }

    try {
      setResults(buildComparisonResults(nextParams, nextGlobalParams));
      setAiAnalysis("");
      setPdfData(null);
      setError("");
      setActivePreset(nextPreset);
    } catch (calculationError) {
      setError(calculationError.message || "LCOE calculation failed.");
      setAiAnalysis("");
      setPdfData(null);
    }
  }

  function handleTechnologyFieldChange(key, field, value) {
    const nextParams = {
      ...params,
      [key]: {
        ...params[key],
        [field]: value,
      },
    };

    setParams(nextParams);
    applyLocalResults(nextParams, globalParams);
  }

  function handleTechnologyToggle(key) {
    if (params[key].active && activeCount <= 2) {
      return;
    }

    const nextParams = {
      ...params,
      [key]: {
        ...params[key],
        active: !params[key].active,
      },
    };

    setParams(nextParams);
    applyLocalResults(nextParams, globalParams);
  }

  function handleResetTechnology(key) {
    const nextParams = {
      ...params,
      [key]: {
        ...TECH_DEFAULTS[key],
        active: true,
      },
    };

    setParams(nextParams);
    applyLocalResults(nextParams, globalParams);
  }

  function handleGlobalFieldChange(field, value) {
    const nextGlobalParams = {
      ...globalParams,
      [field]: value,
    };

    setGlobalParams(nextGlobalParams);
    applyLocalResults(params, nextGlobalParams);
  }

  function handleCalculateAll() {
    let nextResults;

    try {
      nextResults = buildComparisonResults(params, globalParams);
      setResults(nextResults);
      setActiveTab("results");
      setError("");
      setAiAnalysis("");
      const nextPdfData = buildLcoePdfData(nextResults, globalParams, activePreset, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.lcoe,
        createToolReportSnapshot({
          toolName: "LCOE Comparator",
          inputs: {
            activePreset,
            discountRate: globalParams.discountRate,
            carbonCostPerTon: globalParams.carbonCostPerTon,
            technologies: params,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "LCOE calculation failed.");
      setResults(null);
      setAiAnalysis("");
      setPdfData(null);
      return;
    }

    setLoadingAI(true);

    callGemini(buildLcoePrompt(nextResults, globalParams))
      .then((analysis) => {
        setAiAnalysis(analysis);
        const nextPdfData = buildLcoePdfData(nextResults, globalParams, activePreset, analysis);
        setPdfData(nextPdfData);
        saveToolReportResult(
          REPORT_STORAGE_KEYS.lcoe,
          createToolReportSnapshot({
            toolName: "LCOE Comparator",
            inputs: {
              activePreset,
              discountRate: globalParams.discountRate,
              carbonCostPerTon: globalParams.carbonCostPerTon,
              technologies: params,
            },
            results: nextResults,
            pdfData: nextPdfData,
            aiAnalysis: analysis,
          })
        );
      })
      .catch(() => {
        setError("AI analysis failed. Results are still available.");
        const nextPdfData = buildLcoePdfData(nextResults, globalParams, activePreset, "");
        setPdfData(nextPdfData);
        saveToolReportResult(
          REPORT_STORAGE_KEYS.lcoe,
          createToolReportSnapshot({
            toolName: "LCOE Comparator",
            inputs: {
              activePreset,
              discountRate: globalParams.discountRate,
              carbonCostPerTon: globalParams.carbonCostPerTon,
              technologies: params,
            },
            results: nextResults,
            pdfData: nextPdfData,
            aiAnalysis: "",
          })
        );
      })
      .finally(() => {
        setLoadingAI(false);
      });
  }

  function applyPreset(presetKey) {
    const preset = PRESET_CONFIG[presetKey];

    if (!preset) {
      return;
    }

    const nextGlobalParams = {
      discountRate: preset.discountRate,
      carbonCostPerTon: preset.carbonCostPerTon,
    };

    setGlobalParams(nextGlobalParams);
    setActivePreset(presetKey);
    setAiAnalysis("");
    setPdfData(null);
    setError("");

    try {
      const nextResults = buildComparisonResults(params, nextGlobalParams);
      setResults(nextResults);
      setActiveTab("results");
    } catch (calculationError) {
      setError(calculationError.message || "LCOE calculation failed.");
      setResults(null);
    }
  }

  function handleResetAll() {
    const nextParams = createDefaultParams();
    const nextGlobalParams = { discountRate: 8, carbonCostPerTon: 0 };

    setParams(nextParams);
    setGlobalParams(nextGlobalParams);
    setActivePreset("custom");
    setAiAnalysis("");
    setPdfData(null);
    setError("");
    setActiveTab("inputs");

    if (!results) {
      setResults(null);
      return;
    }

    try {
      setResults(buildComparisonResults(nextParams, nextGlobalParams));
    } catch {
      setResults(null);
    }
  }

  const totalLcoeChartData = useMemo(() => {
    if (!results) {
      return null;
    }

    return {
      labels: results.activeTechs.map((technology) => technology.name),
      datasets: [
        {
          label: "LCOE",
          data: results.activeTechs.map((technology) => Number(technology.lcoe.toFixed(2))),
          backgroundColor: results.activeTechs.map((technology) => technology.color),
          borderRadius: 8,
          barThickness: 24,
        },
      ],
    };
  }, [results]);

  const totalLcoeChartOptions = useMemo(() => {
    const maxValue = results
      ? Math.max(...results.activeTechs.map((technology) => technology.lcoe)) * 1.2
      : 100;

    return {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${formatCurrency(context.parsed.x, 1)}/MWh`;
            },
          },
        },
        barValueLabelPlugin: { enabled: true, datasetIndex: 0 },
      },
      scales: {
        x: {
          min: 0,
          max: Number.isFinite(maxValue) ? maxValue : 100,
          title: { display: true, text: "$/MWh" },
          ticks: {
            callback(value) {
              return `$${value}`;
            },
          },
        },
        y: {
          grid: { display: false },
        },
      },
    };
  }, [results]);

  const breakdownChartData = useMemo(() => {
    if (!results) {
      return null;
    }

    return {
      labels: results.activeTechs.map((technology) => technology.name),
      datasets: BREAKDOWN_META.map((item) => ({
        label: item.label,
        data: results.activeTechs.map((technology) =>
          Number(technology.breakdown[item.key].toFixed(2))
        ),
        backgroundColor: item.color,
        barThickness: 24,
      })),
    };
  }, [results]);

  const breakdownChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.x, 1)}/MWh`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: "$/MWh" },
      },
      y: {
        stacked: true,
        grid: { display: false },
      },
    },
  };

  const sensitivityChartData = useMemo(() => {
    if (!results) {
      return null;
    }

    const allY = results.sensitivitySeries.flatMap((series) => series.points.map((point) => point.y));
    const maxY = allY.length ? Math.max(...allY) * 1.15 : 100;

    return {
      datasets: results.sensitivitySeries.flatMap((series) => [
        {
          type: "line",
          label: series.name,
          data: series.points,
          borderColor: series.color,
          backgroundColor: series.color,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2,
          tension: 0.3,
        },
        {
          type: "line",
          label: `${series.name} current CF`,
          data: [
            { x: clampCapacityFactor(series.currentCf), y: 0 },
            { x: clampCapacityFactor(series.currentCf), y: maxY },
          ],
          borderColor: series.colorDark,
          pointRadius: 0,
          borderDash: [6, 6],
          borderWidth: 1,
          fill: false,
        },
      ]),
    };
  }, [results]);

  const sensitivityChartOptions = useMemo(() => {
    const values = results
      ? results.sensitivitySeries.flatMap((series) => series.points.map((point) => point.y))
      : [];
    const maxY = values.length ? Math.max(...values) * 1.15 : 100;

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              if (context.dataset.label?.endsWith("current CF")) {
                return ` ${context.dataset.label}`;
              }

              return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y, 1)}/MWh`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: 10,
          max: 95,
          title: { display: true, text: "Capacity factor (%)" },
          ticks: { stepSize: 10 },
          grid: { display: false },
        },
        y: {
          min: 0,
          max: Number.isFinite(maxY) ? maxY : 100,
          title: { display: true, text: "$/MWh" },
          ticks: {
            callback(value) {
              return `$${value}`;
            },
          },
        },
      },
    };
  }, [results]);

  return (
    <section className="mx-auto max-w-7xl pb-16 pt-2 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="amber">Financial</Badge>
          <Badge color="green">Pure calculation + Gemini</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          LCOE Comparator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Compare levelized cost of energy for solar, wind, gas, and nuclear with CAPEX breakdown,
          carbon pricing, and sensitivity analysis.
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {hasResults ? (
        <div className="mt-8 flex gap-2 lg:hidden">
          <PresetButton active={activeTab === "inputs"} onClick={() => setActiveTab("inputs")}>
            Inputs
          </PresetButton>
          <PresetButton active={activeTab === "results"} onClick={() => setActiveTab("results")}>
            Results
          </PresetButton>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        <div className={cn(activeTab === "inputs" ? "block" : "hidden", "lg:block")}>
          <PanelCard className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-2">
                <SliderField
                  label="Discount rate (WACC)"
                  min={3}
                  max={15}
                  step={0.5}
                  value={globalParams.discountRate}
                  onChange={(event) =>
                    handleGlobalFieldChange("discountRate", Number(event.target.value))
                  }
                  displayValue={`${globalParams.discountRate.toFixed(1)}%`}
                />
                <p className="text-sm text-[var(--color-text-muted)]">
                  Weighted average cost of capital
                </p>
              </div>
              <div className="space-y-2">
                <SliderField
                  label="Carbon price ($/tCO2)"
                  min={0}
                  max={200}
                  step={5}
                  value={globalParams.carbonCostPerTon}
                  onChange={(event) =>
                    handleGlobalFieldChange("carbonCostPerTon", Number(event.target.value))
                  }
                  displayValue={`${formatCurrency(globalParams.carbonCostPerTon, 0)}/t`}
                />
                <p className="text-sm text-[var(--color-text-muted)]">
                  EU ETS ~$65, projected $130 by 2030
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 xl:w-[220px]">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="min-h-[48px] rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
                >
                  Reset all to defaults
                </button>
                <ActionButton onClick={handleCalculateAll} loading={loadingAI} variant="primary">
                  Calculate all
                </ActionButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_CONFIG).map(([presetKey, preset]) => (
                <PresetButton
                  key={presetKey}
                  active={activePreset === presetKey}
                  onClick={() => applyPreset(presetKey)}
                >
                  {preset.label}
                </PresetButton>
              ))}
            </div>
          </PanelCard>

          <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
            {TECH_ORDER.map((key) => (
              <TechnologyCard
                key={key}
                technology={{ key, ...params[key] }}
                capexRange={CAPEX_RANGES[key]}
                previewValue={previewResults[key]?.lcoe ?? null}
                activeCount={activeCount}
                discountRate={globalParams.discountRate}
                onToggle={handleTechnologyToggle}
                onFieldChange={handleTechnologyFieldChange}
                onReset={handleResetTechnology}
              />
            ))}
          </div>
        </div>

        <div className={cn(activeTab === "results" ? "block" : "hidden", "lg:block")}>
          {hasResults ? (
            <div className="space-y-6">
              {globalParams.carbonCostPerTon > 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--badge-amber-border)] bg-[var(--badge-amber-bg)] px-4 py-3 text-sm font-medium text-[var(--badge-amber-text)]">
                  Carbon pricing adds {formatCurrency(gasCarbon, 0)}/MWh to gas and{" "}
                  {formatCurrency(nuclearCarbon, 0)}/MWh to nuclear costs
                </div>
              ) : null}

              <div
                className="rounded-[var(--radius-lg)] px-5 py-4"
                style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
              >
                <p className="text-base font-medium">
                  Lowest LCOE: {results.cheapest.name} at {formatCurrency(results.cheapest.lcoe, 1)}
                  /MWh
                </p>
                <p className="mt-1 text-sm">
                  Based on current inputs and {globalParams.discountRate.toFixed(1)}% discount rate
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <LcoeMetricCard label="Cheapest source" value={results.cheapest.name} unit="" accent />
                <LcoeMetricCard label="Most expensive" value={results.mostExpensive.name} unit="" />
                <LcoeMetricCard
                  label="LCOE spread"
                  value={formatCurrency(results.mostExpensive.lcoe - results.cheapest.lcoe, 0)}
                  unit="/MWh"
                />
              </div>

              <PanelCard className="space-y-4">
                <SectionLabel>LCOE comparison</SectionLabel>
                <div className="h-[280px]">
                  {totalLcoeChartData ? (
                    <Bar
                      data={totalLcoeChartData}
                      options={totalLcoeChartOptions}
                      plugins={[barValueLabelPlugin]}
                    />
                  ) : null}
                </div>
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>Cost breakdown</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {BREAKDOWN_META.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 rounded-full bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] [border:var(--border-default)]"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="h-[280px]">
                  {breakdownChartData ? <Bar data={breakdownChartData} options={breakdownChartOptions} /> : null}
                </div>
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>Results table</SectionLabel>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[12px]">
                    <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-3 py-3 font-medium">Technology</th>
                        <th className="px-3 py-3 font-medium">LCOE</th>
                        <th className="px-3 py-3 font-medium">CAPEX</th>
                        <th className="px-3 py-3 font-medium">Fixed O&amp;M</th>
                        <th className="px-3 py-3 font-medium">Fuel</th>
                        <th className="px-3 py-3 font-medium">Carbon</th>
                        <th className="px-3 py-3 font-medium">CF%</th>
                        <th className="px-3 py-3 font-medium">CO2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.activeTechs.map((technology, index) => {
                        const accentClass =
                          index === 0
                            ? "border-l-4 border-[var(--color-brand)]"
                            : index === results.activeTechs.length - 1
                              ? "border-l-4 border-red-400"
                              : "";

                        return (
                          <tr
                            key={technology.key}
                            className="border-t [border-top:var(--border-default)] text-[var(--color-text)]"
                          >
                            <td className={cn("px-3 py-3 font-semibold", accentClass)}>
                              {technology.name}
                            </td>
                            <td className="px-3 py-3">{formatCurrency(technology.lcoe, 1)}</td>
                            <td className="px-3 py-3">{formatCurrency(technology.breakdown.capex, 1)}</td>
                            <td className="px-3 py-3">
                              {formatCurrency(technology.breakdown.fixedOpex, 1)}
                            </td>
                            <td className="px-3 py-3">
                              {technology.fuelCostPerMwh > 0
                                ? formatCurrency(technology.breakdown.fuel, 1)
                                : "—"}
                            </td>
                            <td className="px-3 py-3">
                              {formatCurrency(technology.breakdown.carbon, 1)}
                            </td>
                            <td className="px-3 py-3">{technology.capacityFactor}%</td>
                            <td className="px-3 py-3">
                              {formatEmissions(technology.emissionsFactor)} t/MWh
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>Sensitivity analysis</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {results.activeTechs.map((technology) => (
                    <div
                      key={technology.key}
                      className="flex items-center gap-2 rounded-full bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] [border:var(--border-default)]"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: technology.color }}
                      />
                      <span>{technology.name}</span>
                    </div>
                  ))}
                </div>
                <div className="h-[220px]">
                  {sensitivityChartData ? <Line data={sensitivityChartData} options={sensitivityChartOptions} /> : null}
                </div>
              </PanelCard>

              <PanelCard className="space-y-4 border border-[var(--badge-amber-border)] bg-[var(--badge-amber-bg)]">
                <SectionLabel>NREL 2030 Cost Projections</SectionLabel>
                <div className="grid gap-4 md:grid-cols-3">
                  {PROJECTION_DATA.map((item) => (
                    <div
                      key={item.name}
                      className="rounded-[var(--radius-md)] bg-white/70 px-4 py-4 text-[var(--badge-amber-text)] [border:var(--border-default)]"
                    >
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="mt-3 text-base font-medium">
                        {formatCurrency(item.current, 0)}/MWh -&gt; {formatCurrency(item.future, 0)}/MWh
                      </p>
                      <p className="mt-2 text-sm font-semibold">{item.change}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-[var(--badge-amber-text)]/90">
                  Source: NREL Annual Technology Baseline 2024
                </p>
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>AI analysis</SectionLabel>
                {loadingAI ? (
                  <LoadingIndicator message="AI is analyzing market context..." />
                ) : aiAnalysis ? (
                  <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                    {aiAnalysis}
                  </p>
                ) : (
                  <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                    Calculate the comparison to generate ranking commentary, carbon-price impact,
                    and capital-structure context.
                  </p>
                )}
              </PanelCard>

              <ExportButton toolName="LCOE Comparator" data={pdfData} disabled={!pdfData || loadingAI} />
              {pdfData ? <ProjectReportCta /> : null}
            </div>
          ) : (
            <PanelCard className="text-center">
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate at least one comparison to unlock charts, table, AI commentary, and PDF
                export.
              </p>
            </PanelCard>
          )}
        </div>
      </div>
    </section>
  );
}
