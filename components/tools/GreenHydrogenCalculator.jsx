import { useEffect, useState } from "react";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
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
  calcAnnualOpex,
  calcAnnualProduction,
  calcCapex,
  calcCarbonIntensity,
  calcCostBreakdown,
  calcElectrolyzerArea,
  calcLCOH,
  calcStackReplacement,
} from "../../lib/hydrogenCalc";

ChartJS.register(ArcElement, Tooltip, Legend);

const ELECTROLYZER_OPTIONS = {
  pem: {
    label: "PEM (Proton Exchange Membrane)",
    shortLabel: "PEM",
    efficiency: 68,
  },
  alkaline: {
    label: "Alkaline",
    shortLabel: "Alkaline",
    efficiency: 63,
  },
  soec: {
    label: "SOEC (Solid Oxide)",
    shortLabel: "SOEC",
    efficiency: 80,
  },
};

const ELECTRICITY_SOURCE_OPTIONS = {
  solar: "Dedicated Solar PV",
  wind: "Dedicated Wind",
  hydro: "Hydropower",
  grid_eu: "EU Grid Average",
  grid_us: "US Grid Average",
  grid_global: "Global Grid Average",
};

const BREAKDOWN_COLORS = {
  capex: "#085041",
  opex: "#1D9E75",
  electricity: "#5DCAA5",
  stack: "#9FE1CB",
};

const BENCHMARKS = [
  {
    label: "Gray H2",
    value: 1.5,
    color: "bg-slate-500",
    textClass: "text-slate-600 dark:text-slate-300",
    level: 0,
  },
  {
    label: "2030 target",
    value: 2.0,
    color: "bg-[var(--color-brand)]",
    textClass: "text-[var(--color-brand)]",
    level: 1,
  },
  {
    label: "Blue H2",
    value: 2.2,
    color: "bg-sky-500",
    textClass: "text-sky-600 dark:text-sky-300",
    level: 0,
  },
  {
    label: "Current green avg",
    value: 4.5,
    color: "bg-emerald-300",
    textClass: "text-emerald-700 dark:text-emerald-300",
    level: 1,
  },
];

const SENSITIVITY_PRICES = [20, 40, 60, 80, 100];

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "66%",
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${context.label}: ${context.parsed.toFixed(1)}%`;
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
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function getLcohStatus(lcoh) {
  if (lcoh < 2) {
    return {
      label: "Competitive",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }

  if (lcoh <= 4) {
    return {
      label: "Moderate",
      className: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
    };
  }

  return {
    label: "Expensive",
    className: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  };
}

function getCarbonStatus(carbonIntensity) {
  if (carbonIntensity < 1) {
    return {
      label: "Truly green",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }

  if (carbonIntensity < 5) {
    return {
      label: "Low carbon",
      className: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
    };
  }

  return {
    label: "Carbon intensive",
    className: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  };
}

function HydrogenMetricCard({ label, value, unit, accent = false, badge = null }) {
  const wrapperClasses = accent
    ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
    : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]";
  const metaClasses = accent ? "text-white/75" : "text-[var(--color-text-muted)]";

  return (
    <div className={`rounded-[var(--radius-lg)] p-5 ${wrapperClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${metaClasses}`}>
          {label}
        </p>
        {badge ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className={`pb-1 text-sm font-medium ${metaClasses}`}>{unit}</span> : null}
      </div>
    </div>
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

function calculateHydrogenScenario({
  electType,
  ratedMW,
  efficiency,
  capacityFactor,
  electricitySource,
  electricityPrice,
  projectLifetime,
  discountRate,
  includesStorage,
  includesCompressor,
}) {
  const annualKwh = ratedMW * 1000 * 8760 * (capacityFactor / 100);
  const annualH2kg = calcAnnualProduction(ratedMW, capacityFactor, efficiency);
  const annualTonnes = annualH2kg / 1000;
  const electrolyzerAreaKw = calcElectrolyzerArea(ratedMW, electType);
  const capex = calcCapex(ratedMW, electType, includesStorage, includesCompressor);
  const annualOpex = calcAnnualOpex(capex, electType);
  const stackReplacement = calcStackReplacement(capex, electType);
  const r = discountRate / 100;
  const crf = (r * Math.pow(1 + r, projectLifetime)) / (Math.pow(1 + r, projectLifetime) - 1);
  const annualCapex = capex * crf;
  const annualElectricityCost = annualKwh * (electricityPrice / 1000);
  const stackAnnualized = stackReplacement.cost / stackReplacement.every;
  const lcoh = calcLCOH({
    capex,
    annualOpex,
    electricityPrice,
    annualKwh,
    annualH2kg,
    projectLifeYears: projectLifetime,
    discountRate,
    stackCost: stackReplacement.cost,
    stackEvery: stackReplacement.every,
  });
  const breakdown = calcCostBreakdown(
    annualCapex,
    annualOpex,
    annualElectricityCost,
    stackAnnualized
  );
  const carbonIntensity = Number(calcCarbonIntensity(electricitySource));

  return {
    electType,
    ratedMW,
    efficiency,
    capacityFactor,
    electricitySource,
    electricityPrice,
    projectLifetime,
    discountRate,
    includesStorage,
    includesCompressor,
    electrolyzerAreaKw,
    annualKwh,
    annualH2kg,
    annualTonnes,
    capex,
    capexM: capex / 1000000,
    annualOpex,
    annualCapex,
    annualElectricityCost,
    stackCost: stackReplacement.cost,
    stackEvery: stackReplacement.every,
    stackAnnualized,
    lcoh,
    breakdown,
    carbonIntensity,
  };
}

function buildHydrogenPrompt(results) {
  return `Analyze this green hydrogen production system:
Electrolyzer: ${ELECTROLYZER_OPTIONS[results.electType].shortLabel} at ${results.ratedMW.toFixed(1)}MW, ${results.efficiency}% efficiency,
${results.capacityFactor}% capacity factor.
Electricity: ${ELECTRICITY_SOURCE_OPTIONS[results.electricitySource]} at $${results.electricityPrice}/MWh.
Results: LCOH = $${results.lcoh.toFixed(2)}/kg H2,
Annual production = ${results.annualTonnes.toFixed(0)} tonnes/year,
Total CAPEX = $${results.capexM.toFixed(1)}M,
Carbon intensity = ${results.carbonIntensity.toFixed(2)} kg CO2/kg H2,
Cost breakdown: CAPEX ${results.breakdown.capex}%, Electricity ${results.breakdown.electricity}%.
Project: ${results.projectLifetime} years, ${results.discountRate}% discount rate.

Provide a 4-5 sentence professional analysis covering:
1. LCOH competitiveness vs gray hydrogen ($1.5/kg) and 2030 green hydrogen targets ($2/kg)
2. Main cost driver and optimization potential
3. Carbon intensity assessment (truly green if < 1 kg CO2/kg H2)
4. One specific recommendation to reduce LCOH
Be technical and precise.`;
}

function buildSensitivityRows(baseInputs) {
  return SENSITIVITY_PRICES.map((price) => ({
    price,
    lcoh: calculateHydrogenScenario({
      ...baseInputs,
      electricityPrice: price,
    }).lcoh,
  }));
}

function buildHydrogenPdfData(results, aiAnalysis) {
  const sensitivityRows = buildSensitivityRows(results);

  return {
    inputs: {
      "Electrolyzer type": ELECTROLYZER_OPTIONS[results.electType].shortLabel,
      "Rated power": `${results.ratedMW.toFixed(1)} MW`,
      Efficiency: `${results.efficiency}%`,
      "Capacity factor": `${results.capacityFactor}%`,
      "Electricity source": ELECTRICITY_SOURCE_OPTIONS[results.electricitySource],
      "Electricity price": `$${results.electricityPrice}/MWh`,
      "Project lifetime": `${results.projectLifetime} years`,
      "Discount rate": `${results.discountRate}%`,
      "H2 storage": results.includesStorage ? "Yes" : "No",
      Compression: results.includesCompressor ? "Yes" : "No",
    },
    metrics: [
      { label: "LCOH", value: results.lcoh.toFixed(2), unit: "$/kg H2" },
      { label: "Annual Production", value: results.annualTonnes.toFixed(0), unit: "tonnes/year" },
      { label: "Total CAPEX", value: `$${results.capexM.toFixed(1)}M`, unit: "" },
      {
        label: "Carbon Intensity",
        value: results.carbonIntensity.toFixed(2),
        unit: "kg CO2/kg H2",
      },
    ],
    monthlyData: sensitivityRows.map((row) => Number(row.lcoh.toFixed(2))),
    monthlyLabels: SENSITIVITY_PRICES.map((price) => `$${price}`),
    aiAnalysis,
  };
}

export default function GreenHydrogenCalculator() {
  const [electType, setElectType] = useState("pem");
  const [ratedMW, setRatedMW] = useState(5);
  const [efficiency, setEfficiency] = useState(ELECTROLYZER_OPTIONS.pem.efficiency);
  const [capacityFactor, setCapacityFactor] = useState(45);
  const [electricitySource, setElectricitySource] = useState("solar");
  const [electricityPrice, setElectricityPrice] = useState(40);
  const [projectLifetime, setProjectLifetime] = useState(20);
  const [discountRate, setDiscountRate] = useState(8);
  const [includesStorage, setIncludesStorage] = useState(false);
  const [includesCompressor, setIncludesCompressor] = useState(false);
  const [results, setResults] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setEfficiency(ELECTROLYZER_OPTIONS[electType].efficiency);
  }, [electType]);

  const hasResults = Boolean(results);
  const lcohStatus = hasResults ? getLcohStatus(results.lcoh) : null;
  const carbonStatus = hasResults ? getCarbonStatus(results.carbonIntensity) : null;
  const sensitivityRows = hasResults
    ? buildSensitivityRows(results)
    : SENSITIVITY_PRICES.map((price) => ({ price, lcoh: null }));

  const doughnutData = {
    labels: ["CAPEX", "OPEX", "Electricity", "Stack replacement"],
    datasets: [
      {
        data: hasResults
          ? [
              Number(results.breakdown.capex),
              Number(results.breakdown.opex),
              Number(results.breakdown.electricity),
              Number(results.breakdown.stack),
            ]
          : [0, 0, 0, 0],
        backgroundColor: [
          BREAKDOWN_COLORS.capex,
          BREAKDOWN_COLORS.opex,
          BREAKDOWN_COLORS.electricity,
          BREAKDOWN_COLORS.stack,
        ],
        borderWidth: 0,
      },
    ],
  };

  async function handleCalculate() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = calculateHydrogenScenario({
        electType,
        ratedMW,
        efficiency,
        capacityFactor,
        electricitySource,
        electricityPrice,
        projectLifetime,
        discountRate,
        includesStorage,
        includesCompressor,
      });
      setResults(nextResults);
      const nextPdfData = buildHydrogenPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.h2,
        createToolReportSnapshot({
          toolName: "Green Hydrogen Calculator",
          inputs: {
            electType,
            ratedMW,
            efficiency,
            capacityFactor,
            electricitySource,
            electricityPrice,
            projectLifetime,
            discountRate,
            includesStorage,
            includesCompressor,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Hydrogen cost calculation failed.");
      setResults(null);
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildHydrogenPrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildHydrogenPdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.h2,
        createToolReportSnapshot({
          toolName: "Green Hydrogen Calculator",
          inputs: {
            electType,
            ratedMW,
            efficiency,
            capacityFactor,
            electricitySource,
            electricityPrice,
            projectLifetime,
            discountRate,
            includesStorage,
            includesCompressor,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildHydrogenPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.h2,
        createToolReportSnapshot({
          toolName: "Green Hydrogen Calculator",
          inputs: {
            electType,
            ratedMW,
            efficiency,
            capacityFactor,
            electricitySource,
            electricityPrice,
            projectLifetime,
            discountRate,
            includesStorage,
            includesCompressor,
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
          <Badge color="teal">New tool</Badge>
          <Badge color="green">Pure calculation</Badge>
        </div>
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Green Hydrogen Calculator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Levelized cost of hydrogen, CAPEX and OPEX drivers, carbon intensity, and AI market
          context for electrolysis projects.
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
            <SectionLabel>Electrolyzer system</SectionLabel>
            <label className="flex flex-col gap-2">
              <SectionLabel>Electrolyzer type</SectionLabel>
              <select
                value={electType}
                onChange={(event) => setElectType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {Object.entries(ELECTROLYZER_OPTIONS).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <SliderField
              label="Rated power"
              min={0.1}
              max={50}
              step={0.1}
              value={ratedMW}
              onChange={(event) => setRatedMW(Number(event.target.value))}
              displayValue={`${ratedMW.toFixed(1)} MW`}
            />
            <SliderField
              label="System efficiency"
              min={55}
              max={85}
              step={1}
              value={efficiency}
              onChange={(event) => setEfficiency(Number(event.target.value))}
              displayValue={`${efficiency}%`}
            />
            <div className="space-y-2">
              <SliderField
                label="Capacity factor"
                min={10}
                max={95}
                step={1}
                value={capacityFactor}
                onChange={(event) => setCapacityFactor(Number(event.target.value))}
                displayValue={`${capacityFactor}%`}
              />
              <p className="text-sm text-[var(--color-text-muted)]">
                Hours the electrolyzer operates per year divided by 8760.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <SectionLabel>Energy source & cost</SectionLabel>
            <label className="flex flex-col gap-2">
              <SectionLabel>Electricity source</SectionLabel>
              <select
                value={electricitySource}
                onChange={(event) => setElectricitySource(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {Object.entries(ELECTRICITY_SOURCE_OPTIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <SliderField
              label="Electricity price"
              min={10}
              max={150}
              step={1}
              value={electricityPrice}
              onChange={(event) => setElectricityPrice(Number(event.target.value))}
              displayValue={`$${electricityPrice}/MWh`}
            />
          </div>

          <div className="space-y-5">
            <SectionLabel>Financial parameters</SectionLabel>
            <SliderField
              label="Project lifetime"
              min={10}
              max={30}
              step={1}
              value={projectLifetime}
              onChange={(event) => setProjectLifetime(Number(event.target.value))}
              displayValue={`${projectLifetime} years`}
            />
            <SliderField
              label="Discount rate"
              min={3}
              max={15}
              step={0.5}
              value={discountRate}
              onChange={(event) => setDiscountRate(Number(event.target.value))}
              displayValue={`${discountRate.toFixed(1)}%`}
            />
            <label className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
              <input
                type="checkbox"
                checked={includesStorage}
                onChange={(event) => setIncludesStorage(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                Include H2 storage tank (+$150/kW)
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
              <input
                type="checkbox"
                checked={includesCompressor}
                onChange={(event) => setIncludesCompressor(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="text-sm text-[var(--color-text)]">
                Include compression system (+$200/kW)
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} loading={loadingAI} variant="primary">
              Calculate LCOH -&gt;
            </ActionButton>
            {loadingAI ? <LoadingIndicator message="AI is analyzing hydrogen economics..." /> : null}
          </div>
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <HydrogenMetricCard
              label="LCOH"
              value={hasResults ? formatNumber(results.lcoh, 2) : "--"}
              unit="$/kg H2"
              accent
              badge={lcohStatus}
            />
            <HydrogenMetricCard
              label="Annual H2 production"
              value={hasResults ? formatNumber(results.annualTonnes, 0) : "--"}
              unit="tonnes/year"
            />
            <HydrogenMetricCard
              label="Total CAPEX"
              value={hasResults ? formatNumber(results.capexM, 1) : "--"}
              unit="$M"
            />
            <HydrogenMetricCard
              label="Carbon intensity"
              value={hasResults ? formatNumber(results.carbonIntensity, 2) : "--"}
              unit="kg CO2/kg H2"
              badge={carbonStatus}
            />
          </div>

          <PanelCard className="space-y-5">
            <SectionLabel>Where does your LCOH stand?</SectionLabel>
            <div className="relative px-2 pt-10">
              <div className="relative h-2 rounded-full bg-[var(--color-overlay-subtle)]">
                {BENCHMARKS.map((benchmark) => (
                  <div
                    key={benchmark.label}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${Math.min((benchmark.value / 8) * 100, 100)}%` }}
                  >
                    <span className={`block h-3 w-3 rounded-full ${benchmark.color}`} />
                    <span
                      className={`absolute left-1/2 w-24 -translate-x-1/2 text-center text-[10px] font-semibold ${benchmark.textClass} ${benchmark.level === 0 ? "-top-8" : "top-4"}`}
                    >
                      {benchmark.label} ${benchmark.value}
                    </span>
                  </div>
                ))}
                {hasResults ? (
                  <div
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${Math.max(0, Math.min((results.lcoh / 8) * 100, 100))}%` }}
                  >
                    <span className="block h-4 w-4 rounded-full border-2 border-white bg-[var(--color-brand)] shadow-[0_0_0_2px_rgba(29,158,117,0.25)]" />
                    <span className="absolute -top-10 left-1/2 w-24 -translate-x-1/2 text-center text-[10px] font-semibold text-[var(--color-brand)]">
                      Your result ${results.lcoh.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-12 flex items-center justify-between text-[11px] font-medium text-[var(--color-text-muted)]">
                <span>$0/kg</span>
                <span>$8/kg</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard className="space-y-5">
            <SectionLabel>Cost breakdown</SectionLabel>
            <div className="mx-auto h-[200px] max-w-[260px]">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "capex", label: "CAPEX", color: BREAKDOWN_COLORS.capex },
                { key: "opex", label: "OPEX", color: BREAKDOWN_COLORS.opex },
                {
                  key: "electricity",
                  label: "Electricity",
                  color: BREAKDOWN_COLORS.electricity,
                },
                {
                  key: "stack",
                  label: "Stack replacement",
                  color: BREAKDOWN_COLORS.stack,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-3 py-2 [border:var(--border-default)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-[var(--color-text)]">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {hasResults ? `${results.breakdown[item.key]}%` : "--"}
                  </span>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Sensitivity analysis</SectionLabel>
            <div className="overflow-hidden rounded-[var(--radius-md)] [border:var(--border-default)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Electricity price</th>
                    <th className="px-4 py-3 font-medium">LCOH</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityRows.map((row) => {
                    const isBenchmarkRow = row.price === 40;

                    return (
                      <tr
                        key={row.price}
                        className={isBenchmarkRow ? "bg-[var(--color-brand-light)]/55" : "bg-[var(--color-surface)]"}
                      >
                        <td
                          className={`px-4 py-3 text-[var(--color-text)] ${isBenchmarkRow ? "border-l-4 border-[var(--color-brand)] font-semibold" : ""}`}
                        >
                          ${row.price}/MWh {isBenchmarkRow ? "(current)" : ""}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--color-text)]">
                          {row.lcoh === null ? "--" : `$${row.lcoh.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing hydrogen economics..." />
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
                Calculate the system to generate AI market context and optimization guidance.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Green Hydrogen Calculator"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
