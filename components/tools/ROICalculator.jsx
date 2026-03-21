import { useState } from "react";
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
import { calculateROIProjection } from "../../lib/roiCalc";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const EMPTY_YEARLY_DATA = Array.from({ length: 25 }, (_, index) => ({
  year: index + 1,
  value: 0,
}));

const EMPTY_RESULTS = {
  paybackYear: null,
  net25: null,
  roi: null,
  year1saving: null,
  cumulative: null,
  yearlyData: EMPTY_YEARLY_DATA,
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label(context) {
          return ` ${formatCurrency(context.parsed.y, 0)}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      title: {
        display: true,
        text: "Cumulative profit / loss ($)",
      },
      ticks: {
        callback(value) {
          return formatCurrency(value, 0);
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

function formatCurrency(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatKwP(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function PaybackMetricCard({ value }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--badge-amber-bg)] p-5 text-[var(--badge-amber-text)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/80">
        Payback period
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {value !== "Not reached" ? (
          <span className="pb-1 text-sm font-medium text-current/80">years</span>
        ) : null}
      </div>
    </div>
  );
}

function buildSummary(kWp, results) {
  const systemSize = formatKwP(kWp);
  const netProfit = formatCurrency(results.net25, 0);

  if (results.paybackYear) {
    return `Your ${systemSize}kWp system pays back in ${results.paybackYear} years and generates ${netProfit} net profit over 25 years.`;
  }

  return `Your ${systemSize}kWp system does not pay back within 25 years and ends at ${netProfit} net profit over 25 years.`;
}

function buildRoiPdfData({
  systemCost,
  kWp,
  annualYield,
  tariff,
  escalation,
  selfConsumption,
  results,
}) {
  return {
    inputs: {
      systemCost: formatCurrency(systemCost, 0),
      systemSize: `${formatKwP(kWp)} kWp`,
      annualYield: `${annualYield} kWh/kWp`,
      electricityTariff: `${formatCurrency(tariff, 2)}/kWh`,
      escalationRate: `${escalation}%`,
      selfConsumption: `${selfConsumption}%`,
    },
    metrics: [
      {
        label: "Payback Period",
        value: results.paybackYear ? String(results.paybackYear) : "Not reached",
        unit: "years",
      },
      { label: "25-Year Net Gain", value: formatNumber(results.net25, 0), unit: "$" },
      { label: "Year 1 Saving", value: formatNumber(results.year1saving, 0), unit: "$" },
      { label: "ROI (25 years)", value: formatNumber(results.roi, 0), unit: "%" },
    ],
    monthlyData: results.yearlyData.map((entry) => Number(entry.value.toFixed(2))),
    monthlyLabels: results.yearlyData.map((entry) => `Y${entry.year}`),
    aiAnalysis: null,
  };
}

export default function ROICalculator() {
  const [systemCost, setSystemCost] = useState(40000);
  const [kWp, setKWp] = useState(10);
  const [annualYield, setAnnualYield] = useState(1350);
  const [tariff, setTariff] = useState(0.15);
  const [escalation, setEscalation] = useState(5);
  const [selfConsumption, setSelfConsumption] = useState(70);
  const [degradation, setDegradation] = useState(0.5);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [pdfData, setPdfData] = useState(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const hasResults = results.net25 !== null;
  const yearlyData = results.yearlyData?.length ? results.yearlyData : EMPTY_YEARLY_DATA;

  const chartData = {
    labels: yearlyData.map((entry) => `Year ${entry.year}`),
    datasets: [
      {
        label: "Cumulative profit / loss",
        data: yearlyData.map((entry) => Number(entry.value.toFixed(2))),
        backgroundColor: yearlyData.map((entry) => (entry.value >= 0 ? "#97C459" : "#F09595")),
        borderRadius: 6,
      },
    ],
  };

  function handleCalculate() {
    setError("");
    setSummary("");
    setPdfData(null);

    try {
      const nextResults = calculateROIProjection({
        systemCost,
        kWp,
        annualYield,
        tariff,
        escalation,
        selfConsumption,
        degradation,
      });

      setResults(nextResults);
      const nextSummary = buildSummary(kWp, nextResults);
      const nextPdfData = buildRoiPdfData({
        systemCost,
        kWp,
        annualYield,
        tariff,
        escalation,
        selfConsumption,
        results: nextResults,
      });
      setSummary(nextSummary);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.roi,
        createToolReportSnapshot({
          toolName: "Solar ROI Calculator",
          inputs: {
            systemCost,
            kWp,
            annualYield,
            tariff,
            escalation,
            selfConsumption,
            degradation,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: nextSummary,
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "ROI calculation failed.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-20">
      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          ROI Calculator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Model long-term savings, investment recovery, and 25-year net return for a solar system.
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
              label="System cost"
              min={5000}
              max={200000}
              step={1000}
              value={systemCost}
              onChange={(event) => setSystemCost(Number(event.target.value))}
              displayValue={formatCurrency(systemCost, 0)}
            />
            <SliderField
              label="System size"
              min={1}
              max={50}
              step={0.5}
              value={kWp}
              onChange={(event) => setKWp(Number(event.target.value))}
              displayValue={`${formatKwP(kWp)} kWp`}
            />
            <SliderField
              label="Annual yield"
              min={500}
              max={2000}
              step={50}
              value={annualYield}
              onChange={(event) => setAnnualYield(Number(event.target.value))}
              displayValue={`${annualYield} kWh/kWp`}
            />
            <SliderField
              label="Electricity tariff"
              min={0.05}
              max={0.5}
              step={0.01}
              value={tariff}
              onChange={(event) => setTariff(Number(event.target.value))}
              displayValue={`${formatCurrency(tariff, 2)}/kWh`}
            />
            <SliderField
              label="Annual tariff escalation"
              min={0}
              max={30}
              step={1}
              value={escalation}
              onChange={(event) => setEscalation(Number(event.target.value))}
              displayValue={`${escalation}%`}
            />
            <SliderField
              label="Self-consumption ratio"
              min={20}
              max={100}
              step={5}
              value={selfConsumption}
              onChange={(event) => setSelfConsumption(Number(event.target.value))}
              displayValue={`${selfConsumption}%`}
            />
            <SliderField
              label="Panel degradation"
              min={0}
              max={1}
              step={0.1}
              value={degradation}
              onChange={(event) => setDegradation(Number(event.target.value))}
              displayValue={`${degradation.toFixed(1)}%`}
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} variant="primary">
              Calculate
            </ActionButton>
            <p className="text-sm text-[var(--color-text-muted)]">
              Adjust system cost, yield, tariff, and degradation assumptions to test the
              investment case.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <PaybackMetricCard value={hasResults ? results.paybackYear ?? "Not reached" : "--"} />
            <MetricCard
              label="25-year net gain"
              value={hasResults ? formatCurrency(results.net25, 0) : "--"}
              unit=""
            />
            <MetricCard
              label="Year 1 saving"
              value={hasResults ? formatCurrency(results.year1saving, 0) : "--"}
              unit=""
            />
            <MetricCard label="ROI (25 years)" value={hasResults ? formatNumber(results.roi, 0) : "--"} unit="%" />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Profitability timeline</SectionLabel>
            <div className="h-[220px]">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Summary</SectionLabel>
            {summary ? (
              <p className="text-sm leading-7 text-[var(--color-text)]">{summary}</p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate the project to review the 25-year return summary
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Solar ROI Calculator"
            data={pdfData}
            disabled={!hasResults || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
