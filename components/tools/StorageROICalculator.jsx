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
  calcArbitrageRevenue,
  calcBackupValue,
  calcLCOS,
  calcPeakShavingRevenue,
  calcStorageNPV,
} from "../../lib/storageRoiCalc";

ChartJS.register(BarController, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const TECHNOLOGY_PRESETS = {
  lfp: {
    label: "LFP",
    roundTripEfficiency: 92,
    degradationRate: 2,
    technologyLifeYears: 15,
    costPerKwh: 350,
  },
  nmc: {
    label: "NMC",
    roundTripEfficiency: 88,
    degradationRate: 3,
    technologyLifeYears: 10,
    costPerKwh: 280,
  },
  flow: {
    label: "Flow battery",
    roundTripEfficiency: 75,
    degradationRate: 0.5,
    technologyLifeYears: 20,
    costPerKwh: 450,
  },
  custom: {
    label: "Custom",
    roundTripEfficiency: 92,
    degradationRate: 2,
    technologyLifeYears: 15,
    costPerKwh: 350,
  },
};

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]";

const STREAM_META = {
  peak: {
    label: "Peak shaving",
    color: "#1D9E75",
    bg: "#E1F5EE",
    helper: "Avoids monthly demand-charge exposure by limiting site peak demand.",
  },
  arbitrage: {
    label: "Arbitrage",
    color: "#378ADD",
    bg: "#E6F1FB",
    helper: "Monetizes the spread between off-peak charging and peak discharge pricing.",
  },
  backup: {
    label: "Backup",
    color: "#7F77DD",
    bg: "#EEEDFE",
    helper: "Quantifies avoided outage cost for critical operations and uptime protection.",
  },
};

const paybackMarkerPlugin = {
  id: "paybackMarkerPlugin",
  afterDatasetsDraw(chart) {
    const year = chart?.options?.plugins?.paybackMarkerPlugin?.year;

    if (!year || !chart?.data?.datasets?.length) {
      return;
    }

    const meta = chart.getDatasetMeta(0);
    const element = meta?.data?.[year - 1];

    if (!element) {
      return;
    }

    const {
      ctx,
      chartArea: { top, bottom, left, right },
    } = chart;
    const x = element.x;
    const label = `Payback: Year ${year}`;
    ctx.save();
    ctx.font = '600 11px "Helvetica Neue", Arial, sans-serif';
    const labelWidth = ctx.measureText(label).width + 12;
    const labelX = Math.min(Math.max(x - labelWidth / 2, left + 4), right - labelWidth - 4);
    ctx.strokeStyle = "#854F0B";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top + 4);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#FAEEDA";
    ctx.strokeStyle = "#854F0B";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.roundRect(labelX, top + 6, labelWidth, 20, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#854F0B";
    ctx.font = '600 11px "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX + 6, top + 16);
    ctx.restore();
  },
};

const lcosReferencePlugin = {
  id: "lcosReferencePlugin",
  afterDraw(chart) {
    const references = chart?.options?.plugins?.lcosReferencePlugin?.references;

    if (!Array.isArray(references) || !references.length) {
      return;
    }

    const xScale = chart.scales?.x;
    const chartArea = chart.chartArea;

    if (!xScale || !chartArea) {
      return;
    }

    const { ctx } = chart;

    ctx.save();
    ctx.font = '600 11px "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = "top";

    references.forEach((reference, index) => {
      const x = xScale.getPixelForValue(reference.value);

      ctx.strokeStyle = reference.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top + 4);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = reference.color;
      ctx.fillText(reference.label, Math.min(x + 6, chartArea.right - 92), chartArea.top + 8 + index * 14);
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

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function NumberField({ label, value, onChange, min, max, step = "any", helper = "" }) {
  return (
    <label className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className={INPUT_CLASS_NAME}
      />
      {helper ? <p className="text-xs leading-5 text-[var(--color-text-muted)]">{helper}</p> : null}
    </label>
  );
}

function SelectField({ label, value, onChange, options, helper = "" }) {
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

function RevenueToggleCard({ streamKey, enabled, onToggle, children }) {
  const meta = STREAM_META[streamKey];

  return (
    <div
      className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]"
      style={{ opacity: enabled ? 1 : 0.58 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <p className="text-sm font-semibold text-[var(--color-text)]">{meta.label}</p>
          </div>
          <p className="text-xs leading-5 text-[var(--color-text-muted)]">{meta.helper}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold [border:var(--border-default)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>{enabled ? "Enabled" : "Disabled"}</span>
        </label>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function RevenueSummaryCard({ label, value, color, background, highlight = false }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-5",
        highlight ? "sm:col-span-3" : ""
      )}
      style={{
        backgroundColor: background,
        border: `1px solid ${color}`,
        color,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p
        className={cn(
          "mt-3 font-semibold tracking-tight",
          highlight ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
        )}
      >
        {value}
      </p>
      {highlight ? (
        <p className="mt-2 text-sm opacity-80">Combined annual revenue across all enabled storage value streams.</p>
      ) : null}
    </div>
  );
}

function StorageMetricCard({ label, value, unit = "", accentStyle = null, helper = "" }) {
  const isAccent = Boolean(accentStyle);
  const wrapperStyle = isAccent
    ? {
        backgroundColor: accentStyle.bg,
        border: `1px solid ${accentStyle.color}`,
        color: accentStyle.color,
      }
    : undefined;
  const metaStyle = isAccent ? { color: accentStyle.color, opacity: 0.82 } : undefined;

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
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        {unit ? (
          <span
            className={cn("pb-1 text-sm font-medium", !isAccent && "text-[var(--color-text-muted)]")}
            style={metaStyle}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {helper ? (
        <p
          className={cn("mt-3 text-sm leading-6", !isAccent && "text-[var(--color-text-muted)]")}
          style={metaStyle}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function getTechnologySummary(technologyConfig) {
  return `RTE ${technologyConfig.roundTripEfficiency}% | Degradation ${technologyConfig.degradationRate}%/yr | Life ${technologyConfig.technologyLifeYears} yr | ${formatCurrency(technologyConfig.costPerKwh, 0)}/kWh`;
}

function getNpvAccent(npv) {
  if (npv >= 0) {
    return { color: "#1D9E75", bg: "#E1F5EE" };
  }

  return { color: "#A32D2D", bg: "#FCEBEB" };
}

function buildStorageScenario(params) {
  const {
    batteryKwh,
    batteryKw,
    technology,
    technologyConfig,
    installedCostPerKwh,
    peakEnabled,
    demandChargePerkW,
    peakReductionKw,
    arbEnabled,
    dailyCycles,
    priceSpread,
    backupEnabled,
    criticalLoadKw,
    backupHours,
    outageCostPerHour,
    outagesPerYear,
    discountRate,
    projectYears,
    replacementYear,
    replacementCost,
  } = params;

  if (!Number.isFinite(batteryKwh) || batteryKwh <= 0) {
    throw new Error("Battery capacity must be greater than zero.");
  }

  if (!Number.isFinite(batteryKw) || batteryKw <= 0) {
    throw new Error("Power rating must be greater than zero.");
  }

  if (!Number.isFinite(installedCostPerKwh) || installedCostPerKwh <= 0) {
    throw new Error("Installed cost must be greater than zero.");
  }

  const systemCost = batteryKwh * installedCostPerKwh;
  const annualOpex = systemCost * 0.01;
  const monthsPerYear = 12;
  const cyclesPerYear = dailyCycles * 365;

  const peakRevenue = peakEnabled
    ? calcPeakShavingRevenue({
        batteryKwh,
        batteryKw,
        demandChargePerkW,
        peakReductionKw,
        monthsPerYear,
      })
    : 0;
  const arbitrageRevenue = arbEnabled
    ? calcArbitrageRevenue({
        batteryKwh,
        cyclesPerYear,
        priceSpread,
        roundTripEfficiency: technologyConfig.roundTripEfficiency,
        degradationRate: technologyConfig.degradationRate,
      })
    : 0;
  const backupRevenue = backupEnabled
    ? calcBackupValue({
        criticalLoadKw,
        backupHours,
        outageCostPerHour,
        outagesPerYear,
      })
    : 0;
  const annualRevenue = peakRevenue + arbitrageRevenue + backupRevenue;

  const npvResults = calcStorageNPV({
    systemCost,
    annualRevenue,
    annualOpex,
    degradationRate: technologyConfig.degradationRate,
    discountRate,
    projectYears,
    replacementYear,
    replacementCost,
  });
  const lcos = calcLCOS(
    systemCost,
    replacementCost,
    annualOpex,
    batteryKwh,
    cyclesPerYear,
    projectYears,
    discountRate
  );
  const yearlyRevenueData = npvResults.yearlyData.map((entry) => {
    const degFactor = Math.pow(1 - technologyConfig.degradationRate / 100, entry.year - 1);

    return {
      year: entry.year,
      peak: peakRevenue * degFactor,
      arbitrage: arbitrageRevenue * degFactor,
      backup: backupRevenue * degFactor,
      total: annualRevenue * degFactor,
    };
  });
  const netGain = npvResults.yearlyData[npvResults.yearlyData.length - 1]?.cumulative ?? -systemCost;

  return {
    batteryKwh,
    batteryKw,
    technology,
    technologyConfig,
    installedCostPerKwh,
    systemCost,
    annualOpex,
    cyclesPerYear,
    peakEnabled,
    arbEnabled,
    backupEnabled,
    demandChargePerkW,
    peakReductionKw,
    actualPeakReduction: Math.min(peakReductionKw, batteryKw),
    dailyCycles,
    priceSpread,
    criticalLoadKw,
    backupHours,
    outageCostPerHour,
    outagesPerYear,
    discountRate,
    projectYears,
    replacementYear,
    replacementCost,
    revenues: {
      peak: peakRevenue,
      arbitrage: arbitrageRevenue,
      backup: backupRevenue,
      total: annualRevenue,
    },
    npv: npvResults.npv,
    paybackYear: npvResults.paybackYear,
    yearlyData: npvResults.yearlyData,
    yearlyRevenueData,
    lcos,
    netGain,
  };
}

function buildStoragePrompt(results) {
  return `Analyze this battery storage investment:
System: ${results.batteryKwh}kWh / ${results.batteryKw}kW ${results.technologyConfig.label}
Total installed cost: ${formatCurrency(results.systemCost, 0)}
Revenue streams:
  Peak shaving: ${formatCurrency(results.revenues.peak, 0)}/yr (enabled: ${results.peakEnabled})
  Arbitrage: ${formatCurrency(results.revenues.arbitrage, 0)}/yr (enabled: ${results.arbEnabled})
  Backup: ${formatCurrency(results.revenues.backup, 0)}/yr (enabled: ${results.backupEnabled})
Total annual revenue: ${formatCurrency(results.revenues.total, 0)}
NPV: ${formatCurrency(results.npv, 0)}, Payback: ${results.paybackYear ?? "Not reached"} years
LCOS: ${formatCurrency(results.lcos, 3)}/kWh
Project lifetime: ${results.projectYears} years

Provide 4 sentences covering:
1. Investment viability assessment (NPV positive/negative)
2. Which revenue stream dominates and market conditions
3. LCOS competitiveness vs grid electricity price
4. Key assumption most affecting the result and
   sensitivity to it`;
}

function buildStoragePdfData(results, aiAnalysis) {
  return {
    inputs: {
      "Battery capacity": `${results.batteryKwh} kWh`,
      "Power rating": `${results.batteryKw} kW`,
      Technology: results.technologyConfig.label,
      "Installed cost": `${formatCurrency(results.installedCostPerKwh, 0)}/kWh`,
      "System cost": formatCurrency(results.systemCost, 0),
      "Peak shaving": results.peakEnabled ? "Enabled" : "Disabled",
      Arbitrage: results.arbEnabled ? "Enabled" : "Disabled",
      Backup: results.backupEnabled ? "Enabled" : "Disabled",
      "Discount rate": `${results.discountRate}%`,
      "Project lifetime": `${results.projectYears} years`,
      "Replacement year": `Year ${results.replacementYear}`,
      "Replacement cost": formatCurrency(results.replacementCost, 0),
    },
    metrics: [
      {
        label: "Payback period",
        value: results.paybackYear ? String(results.paybackYear) : "Not reached",
        unit: results.paybackYear ? "years" : "",
      },
      { label: "NPV", value: formatNumber(results.npv, 0), unit: "$" },
      { label: "LCOS", value: formatNumber(results.lcos, 3), unit: "$/kWh" },
      {
        label: `${results.projectYears}-year net gain`,
        value: formatNumber(results.netGain, 0),
        unit: "$",
      },
    ],
    monthlyData: results.yearlyData.map((entry) => Number(entry.cumulative.toFixed(2))),
    monthlyLabels: results.yearlyData.map((entry) => `Y${entry.year}`),
    aiAnalysis,
  };
}

export default function StorageROICalculator() {
  const [batteryKwh, setBatteryKwh] = useState(100);
  const [batteryKw, setBatteryKw] = useState(50);
  const [technology, setTechnology] = useState("lfp");
  const [customTech, setCustomTech] = useState({
    roundTripEfficiency: TECHNOLOGY_PRESETS.custom.roundTripEfficiency,
    degradationRate: TECHNOLOGY_PRESETS.custom.degradationRate,
    technologyLifeYears: TECHNOLOGY_PRESETS.custom.technologyLifeYears,
    costPerKwh: TECHNOLOGY_PRESETS.custom.costPerKwh,
  });
  const [installedCostPerKwh, setInstalledCostPerKwh] = useState(TECHNOLOGY_PRESETS.lfp.costPerKwh);
  const [peakEnabled, setPeakEnabled] = useState(true);
  const [demandChargePerkW, setDemandChargePerkW] = useState(12);
  const [peakReductionKw, setPeakReductionKw] = useState(30);
  const [arbEnabled, setArbEnabled] = useState(true);
  const [dailyCycles, setDailyCycles] = useState(1);
  const [priceSpread, setPriceSpread] = useState(0.12);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [criticalLoadKw, setCriticalLoadKw] = useState(50);
  const [backupHours, setBackupHours] = useState(2);
  const [outageCostPerHour, setOutageCostPerHour] = useState(500);
  const [outagesPerYear, setOutagesPerYear] = useState(4);
  const [discountRate, setDiscountRate] = useState(8);
  const [projectYears, setProjectYears] = useState(15);
  const [replacementYear, setReplacementYear] = useState(10);
  const [replacementCost, setReplacementCost] = useState(
    (100 * TECHNOLOGY_PRESETS.lfp.costPerKwh) * 0.4
  );
  const [results, setResults] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [pdfData, setPdfData] = useState(null);

  const activeTechnologyConfig = useMemo(
    () => (technology === "custom" ? customTech : TECHNOLOGY_PRESETS[technology]),
    [customTech, technology]
  );
  const systemCost = batteryKwh * installedCostPerKwh;
  const annualOpex = systemCost * 0.01;
  const hasResults = Boolean(results);

  const revenueSummaryCards = hasResults
    ? [
        {
          label: "Peak shaving",
          value: formatCurrency(results.revenues.peak, 0),
          color: STREAM_META.peak.color,
          background: STREAM_META.peak.bg,
        },
        {
          label: "Arbitrage",
          value: formatCurrency(results.revenues.arbitrage, 0),
          color: STREAM_META.arbitrage.color,
          background: STREAM_META.arbitrage.bg,
        },
        {
          label: "Backup",
          value: formatCurrency(results.revenues.backup, 0),
          color: STREAM_META.backup.color,
          background: STREAM_META.backup.bg,
        },
      ]
    : [];

  const cumulativeCashflowData = useMemo(
    () => ({
      labels: hasResults ? results.yearlyData.map((entry) => `Y${entry.year}`) : [],
      datasets: [
        {
          label: "Cumulative cashflow",
          data: hasResults ? results.yearlyData.map((entry) => Number(entry.cumulative.toFixed(2))) : [],
          backgroundColor: hasResults
            ? results.yearlyData.map((entry) => (entry.cumulative >= 0 ? "#97C459" : "#F09595"))
            : [],
          borderRadius: 6,
        },
      ],
    }),
    [hasResults, results]
  );

  const cumulativeCashflowOptions = useMemo(
    () => ({
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
        paybackMarkerPlugin: {
          year: results?.paybackYear ?? null,
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
            text: "Cumulative cashflow ($)",
          },
          ticks: {
            callback(value) {
              return formatCurrency(value, 0);
            },
          },
        },
      },
    }),
    [results]
  );

  const revenueStackedData = useMemo(
    () => ({
      labels: hasResults ? results.yearlyRevenueData.map((entry) => `Y${entry.year}`) : [],
      datasets: [
        {
          label: "Peak shaving",
          data: hasResults ? results.yearlyRevenueData.map((entry) => Number(entry.peak.toFixed(2))) : [],
          backgroundColor: STREAM_META.peak.color,
          borderRadius: 4,
        },
        {
          label: "Arbitrage",
          data: hasResults
            ? results.yearlyRevenueData.map((entry) => Number(entry.arbitrage.toFixed(2)))
            : [],
          backgroundColor: STREAM_META.arbitrage.color,
          borderRadius: 4,
        },
        {
          label: "Backup",
          data: hasResults ? results.yearlyRevenueData.map((entry) => Number(entry.backup.toFixed(2))) : [],
          backgroundColor: STREAM_META.backup.color,
          borderRadius: 4,
        },
      ],
    }),
    [hasResults, results]
  );

  const revenueStackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label(context) {
            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y, 0)}`;
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
        ticks: {
          callback(value) {
            return formatCurrency(value, 0);
          },
        },
      },
    },
  };

  const lcosComparisonData = useMemo(
    () => ({
      labels: ["Your LCOS"],
      datasets: [
        {
          label: "LCOS",
          data: hasResults ? [Number(results.lcos.toFixed(3))] : [0],
          backgroundColor: "#378ADD",
          borderRadius: 8,
          barThickness: 22,
        },
      ],
    }),
    [hasResults, results]
  );

  const lcosComparisonOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${formatCurrency(context.parsed.x, 3)}/kWh`;
            },
          },
        },
        lcosReferencePlugin: {
          references: [
            { value: 0.12, label: "EU avg $0.12", color: "#854F0B" },
            { value: 0.08, label: "US avg $0.08", color: "#5DCAA5" },
          ],
        },
      },
      scales: {
        x: {
          min: 0,
          max: Math.max(hasResults ? results.lcos * 1.35 : 0.16, 0.16),
          ticks: {
            callback(value) {
              return `$${value}`;
            },
          },
          title: {
            display: true,
            text: "$/kWh",
          },
        },
        y: {
          grid: {
            display: false,
          },
        },
      },
    }),
    [hasResults, results]
  );

  const paybackAccent = { color: "#854F0B", bg: "#FAEEDA" };
  const npvAccent = hasResults ? getNpvAccent(results.npv) : null;

  function clearComputedState(nextError = "") {
    setResults(null);
    setAiAnalysis("");
    setPdfData(null);
    setError(nextError);
  }

  function resetCostInputs(nextTechnology, nextBatteryKwh, nextCustomTech = customTech) {
    const nextConfig = nextTechnology === "custom" ? nextCustomTech : TECHNOLOGY_PRESETS[nextTechnology];
    const nextCost = nextConfig.costPerKwh;

    setInstalledCostPerKwh(nextCost);
    setReplacementCost(nextBatteryKwh * nextCost * 0.4);
  }

  function handleTechnologyChange(event) {
    const nextTechnology = event.target.value;
    clearComputedState();
    setTechnology(nextTechnology);
    resetCostInputs(nextTechnology, batteryKwh);
  }

  function handleBatteryKwhChange(value) {
    const nextBatteryKwh = Number(value);
    clearComputedState();
    setBatteryKwh(nextBatteryKwh);
    resetCostInputs(technology, nextBatteryKwh);
  }

  function handleInstalledCostChange(value) {
    const nextCost = Number(value);
    clearComputedState();
    setInstalledCostPerKwh(nextCost);
    setReplacementCost(batteryKwh * nextCost * 0.4);

    if (technology === "custom") {
      setCustomTech((current) => ({ ...current, costPerKwh: nextCost }));
    }
  }

  function handleCustomTechChange(field, value) {
    const nextValue = Number(value);
    const nextCustomTech = { ...customTech, [field]: nextValue };
    clearComputedState();
    setCustomTech(nextCustomTech);

    if (field === "costPerKwh" && technology === "custom") {
      setInstalledCostPerKwh(nextValue);
      setReplacementCost(batteryKwh * nextValue * 0.4);
    }
  }

  function handleToggle(setter, checked) {
    clearComputedState();
    setter(checked);
  }

  function handleSliderChange(setter, value) {
    clearComputedState();
    setter(Number(value));
  }

  async function handleCalculate() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = buildStorageScenario({
        batteryKwh,
        batteryKw,
        technology,
        technologyConfig: activeTechnologyConfig,
        installedCostPerKwh,
        peakEnabled,
        demandChargePerkW,
        peakReductionKw,
        arbEnabled,
        dailyCycles,
        priceSpread,
        backupEnabled,
        criticalLoadKw,
        backupHours,
        outageCostPerHour,
        outagesPerYear,
        discountRate,
        projectYears,
        replacementYear,
        replacementCost,
      });
      setResults(nextResults);
      const nextPdfData = buildStoragePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.storageRoi,
        createToolReportSnapshot({
          toolName: "Storage ROI Calculator",
          inputs: {
            batteryKwh,
            batteryKw,
            technology,
            installedCostPerKwh,
            peakEnabled,
            demandChargePerkW,
            peakReductionKw,
            arbEnabled,
            dailyCycles,
            priceSpread,
            backupEnabled,
            criticalLoadKw,
            backupHours,
            outageCostPerHour,
            outagesPerYear,
            discountRate,
            projectYears,
            replacementYear,
            replacementCost,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setResults(null);
      setError(calculationError.message || "Storage ROI calculation failed.");
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildStoragePrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildStoragePdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.storageRoi,
        createToolReportSnapshot({
          toolName: "Storage ROI Calculator",
          inputs: {
            batteryKwh,
            batteryKw,
            technology,
            installedCostPerKwh,
            peakEnabled,
            demandChargePerkW,
            peakReductionKw,
            arbEnabled,
            dailyCycles,
            priceSpread,
            backupEnabled,
            criticalLoadKw,
            backupHours,
            outageCostPerHour,
            outagesPerYear,
            discountRate,
            projectYears,
            replacementYear,
            replacementCost,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildStoragePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.storageRoi,
        createToolReportSnapshot({
          toolName: "Storage ROI Calculator",
          inputs: {
            batteryKwh,
            batteryKw,
            technology,
            installedCostPerKwh,
            peakEnabled,
            demandChargePerkW,
            peakReductionKw,
            arbEnabled,
            dailyCycles,
            priceSpread,
            backupEnabled,
            criticalLoadKw,
            backupHours,
            outageCostPerHour,
            outagesPerYear,
            discountRate,
            projectYears,
            replacementYear,
            replacementCost,
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
          <Badge color="blue">New tool</Badge>
          <Badge color="blue">Storage finance</Badge>
          <Badge color="amber">Pure calculation + Gemini</Badge>
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-5xl">
          Storage ROI Calculator
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
          Evaluate storage investment viability across peak shaving, arbitrage, and backup
          resilience value with project-level NPV, payback, and LCOS.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-[var(--radius-md)] bg-red-50 px-4 py-3 text-sm text-red-700 [border:1px_solid_rgba(220,38,38,0.15)]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <PanelCard className="space-y-6">
          <div className="space-y-5">
            <SectionLabel>Battery system</SectionLabel>

            <SliderField
              label="Battery capacity"
              min={10}
              max={10000}
              step={10}
              value={batteryKwh}
              onChange={(event) => handleBatteryKwhChange(event.target.value)}
              displayValue={`${formatNumber(batteryKwh, 0)} kWh`}
            />

            <SliderField
              label="Power rating"
              min={5}
              max={5000}
              step={5}
              value={batteryKw}
              onChange={(event) => handleSliderChange(setBatteryKw, event.target.value)}
              displayValue={`${formatNumber(batteryKw, 0)} kW`}
            />

            <SelectField
              label="Battery technology"
              value={technology}
              onChange={handleTechnologyChange}
              helper={getTechnologySummary(activeTechnologyConfig)}
              options={[
                { value: "lfp", label: "LFP" },
                { value: "nmc", label: "NMC" },
                { value: "flow", label: "Flow battery" },
                { value: "custom", label: "Custom" },
              ]}
            />

            {technology === "custom" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Round-trip efficiency (%)"
                  value={customTech.roundTripEfficiency}
                  onChange={(event) => handleCustomTechChange("roundTripEfficiency", event.target.value)}
                  min="50"
                  max="100"
                  step="1"
                />
                <NumberField
                  label="Degradation rate (%/yr)"
                  value={customTech.degradationRate}
                  onChange={(event) => handleCustomTechChange("degradationRate", event.target.value)}
                  min="0"
                  max="10"
                  step="0.1"
                />
                <NumberField
                  label="Technology life (years)"
                  value={customTech.technologyLifeYears}
                  onChange={(event) =>
                    handleCustomTechChange("technologyLifeYears", event.target.value)
                  }
                  min="5"
                  max="30"
                  step="1"
                />
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-4 [border:var(--border-default)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Installed cost source
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                    Custom cost per kWh is controlled by the installed-cost slider below.
                  </p>
                </div>
              </div>
            ) : null}

            <SliderField
              label="Installed cost"
              min={100}
              max={800}
              step={10}
              value={installedCostPerKwh}
              onChange={(event) => handleInstalledCostChange(event.target.value)}
              displayValue={`${formatCurrency(installedCostPerKwh, 0)}/kWh`}
            />

            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-4 [border:var(--border-default)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Installed system cost
              </p>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                  {formatCurrency(systemCost, 0)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                Technology presets reset installed and replacement cost assumptions whenever battery
                capacity or chemistry changes.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <SectionLabel>Revenue streams</SectionLabel>

            <RevenueToggleCard
              streamKey="peak"
              enabled={peakEnabled}
              onToggle={(checked) => handleToggle(setPeakEnabled, checked)}
            >
              <SliderField
                label="Demand charge"
                min={5}
                max={30}
                step={1}
                value={demandChargePerkW}
                onChange={(event) => handleSliderChange(setDemandChargePerkW, event.target.value)}
                displayValue={`${formatCurrency(demandChargePerkW, 0)}/kW/mo`}
              />
              <SliderField
                label="Peak demand reduced"
                min={10}
                max={500}
                step={5}
                value={peakReductionKw}
                onChange={(event) => handleSliderChange(setPeakReductionKw, event.target.value)}
                displayValue={`${formatNumber(peakReductionKw, 0)} kW`}
              />
            </RevenueToggleCard>

            <RevenueToggleCard
              streamKey="arbitrage"
              enabled={arbEnabled}
              onToggle={(checked) => handleToggle(setArbEnabled, checked)}
            >
              <SliderField
                label="Daily cycles"
                min={0.5}
                max={2}
                step={0.25}
                value={dailyCycles}
                onChange={(event) => handleSliderChange(setDailyCycles, event.target.value)}
                displayValue={`${dailyCycles.toFixed(2)} cycles/day`}
              />
              <SliderField
                label="Price spread"
                min={0.05}
                max={0.3}
                step={0.01}
                value={priceSpread}
                onChange={(event) => handleSliderChange(setPriceSpread, event.target.value)}
                displayValue={`${formatCurrency(priceSpread, 2)}/kWh`}
              />
            </RevenueToggleCard>

            <RevenueToggleCard
              streamKey="backup"
              enabled={backupEnabled}
              onToggle={(checked) => handleToggle(setBackupEnabled, checked)}
            >
              <SliderField
                label="Critical load"
                min={10}
                max={500}
                step={5}
                value={criticalLoadKw}
                onChange={(event) => handleSliderChange(setCriticalLoadKw, event.target.value)}
                displayValue={`${formatNumber(criticalLoadKw, 0)} kW`}
              />
              <SliderField
                label="Backup hours provided"
                min={1}
                max={8}
                step={1}
                value={backupHours}
                onChange={(event) => handleSliderChange(setBackupHours, event.target.value)}
                displayValue={`${formatNumber(backupHours, 0)} hr`}
              />
              <SliderField
                label="Outage cost"
                min={100}
                max={10000}
                step={100}
                value={outageCostPerHour}
                onChange={(event) =>
                  handleSliderChange(setOutageCostPerHour, event.target.value)
                }
                displayValue={`${formatCurrency(outageCostPerHour, 0)}/hr`}
              />
              <SliderField
                label="Outages per year"
                min={1}
                max={20}
                step={1}
                value={outagesPerYear}
                onChange={(event) => handleSliderChange(setOutagesPerYear, event.target.value)}
                displayValue={formatNumber(outagesPerYear, 0)}
              />
            </RevenueToggleCard>
          </div>

          <div className="space-y-5">
            <SectionLabel>Financial</SectionLabel>

            <SliderField
              label="Discount rate"
              min={3}
              max={15}
              step={0.5}
              value={discountRate}
              onChange={(event) => handleSliderChange(setDiscountRate, event.target.value)}
              displayValue={`${discountRate}%`}
            />

            <SliderField
              label="Project lifetime"
              min={10}
              max={20}
              step={1}
              value={projectYears}
              onChange={(event) => handleSliderChange(setProjectYears, event.target.value)}
              displayValue={`${projectYears} years`}
            />

            <SliderField
              label="Battery replacement year"
              min={8}
              max={12}
              step={1}
              value={replacementYear}
              onChange={(event) => handleSliderChange(setReplacementYear, event.target.value)}
              displayValue={`Year ${replacementYear}`}
            />

            <NumberField
              label="Replacement cost ($)"
              value={replacementCost}
              onChange={(event) => handleSliderChange(setReplacementCost, event.target.value)}
              min="0"
              step="100"
              helper={`Default model assumes 40% of capex = ${formatCurrency(systemCost * 0.4, 0)}. Annual O&M is fixed at ${formatCurrency(annualOpex, 0)}/yr.`}
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} loading={loadingAI} variant="primary">
              Calculate ROI
            </ActionButton>
            <p className="text-sm text-[var(--color-text-muted)]">
              The revenue stack is local-engineered first, then Gemini adds market context and
              investment commentary.
            </p>
          </div>
        </PanelCard>

        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <SectionLabel>Revenue breakdown</SectionLabel>
            {hasResults ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {revenueSummaryCards.map((card) => (
                  <RevenueSummaryCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    color={card.color}
                    background={card.background}
                  />
                ))}
                <RevenueSummaryCard
                  label="Total revenue"
                  value={formatCurrency(results.revenues.total, 0)}
                  color="#185FA5"
                  background="#E6F1FB"
                  highlight
                />
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate the storage investment to break annual value into peak shaving,
                arbitrage, and backup resilience revenue streams.
              </p>
            )}
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <StorageMetricCard
              label="Payback period"
              value={hasResults ? results.paybackYear ?? "Not reached" : "--"}
              unit={hasResults && results.paybackYear ? "years" : ""}
              accentStyle={paybackAccent}
              helper={
                hasResults
                  ? results.paybackYear
                    ? "First year cumulative cashflow turns positive."
                    : "Project does not recover initial capex within the selected horizon."
                  : ""
              }
            />
            <StorageMetricCard
              label="NPV"
              value={hasResults ? formatCurrency(results.npv, 0) : "--"}
              accentStyle={npvAccent}
              helper={hasResults ? "Discounted project value after capex, O&M, and replacement cost." : ""}
            />
            <StorageMetricCard
              label="LCOS"
              value={hasResults ? formatCurrency(results.lcos, 3) : "--"}
              unit={hasResults ? "/kWh" : ""}
              helper={hasResults ? "Levelized cost of storage from annualized capex and throughput." : ""}
            />
            <StorageMetricCard
              label={`${projectYears}-year net gain`}
              value={hasResults ? formatCurrency(results.netGain, 0) : "--"}
              helper={hasResults ? "Undiscounted cumulative cashflow over the selected project life." : ""}
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Cumulative cashflow</SectionLabel>
            {hasResults ? (
              <div className="h-[220px]">
                <Bar
                  data={cumulativeCashflowData}
                  options={cumulativeCashflowOptions}
                  plugins={[paybackMarkerPlugin]}
                />
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Run the ROI calculation to review the cumulative cashflow path and payback marker.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Revenue stream profile</SectionLabel>
            {hasResults ? (
              <div className="h-[180px]">
                <Bar data={revenueStackedData} options={revenueStackedOptions} />
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Annual value streams are stacked here year by year after degradation is applied.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>LCOS vs market comparison</SectionLabel>
            {hasResults ? (
              <>
                <div className="h-[180px]">
                  <Bar
                    data={lcosComparisonData}
                    options={lcosComparisonOptions}
                    plugins={[lcosReferencePlugin]}
                  />
                </div>
                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                  Your storage is economical when arbitrage spread exceeds{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {formatCurrency(results.lcos, 3)}/kWh
                  </span>
                  .
                </p>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Compare your modeled storage cost of throughput against wholesale market reference
                prices after calculation.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is evaluating the storage investment case..." />
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
                Calculate the project to generate a viability review, revenue-stream commentary,
                and LCOS competitiveness summary.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Storage ROI Calculator"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
