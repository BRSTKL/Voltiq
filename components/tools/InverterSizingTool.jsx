import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  SunIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
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
  INVERTER_PRESETS,
  MODULE_PRESETS,
  calcDCACRatio,
  calcNumInverters,
  calcStringConfig,
  estimateClippingLoss,
} from "../../lib/inverterCalc";

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]";

const DESIGN_DC_AC_TARGET = 1.25;

const NEXT_STEP_TOOLS = [
  {
    name: "PV Loss Breakdown",
    description: "Use this validated architecture as the basis for downstream PR and loss analysis.",
    href: "/tools/pv-loss",
    Icon: SunIcon,
  },
  {
    name: "Cable Sizing",
    description: "Size the DC homeruns and AC collection cables for the final inverter fleet.",
    href: "/tools/cable",
    Icon: BoltIcon,
  },
  {
    name: "Solar ROI Calculator",
    description: "Turn the checked DC/AC architecture into a financial case.",
    href: "/tools/roi",
    Icon: CurrencyDollarIcon,
  },
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

function formatVoltage(value) {
  return `${formatNumber(value, 1)} V`;
}

function formatPower(value, unit = "kW") {
  return `${formatNumber(value, 1)} ${unit}`;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildModuleForm(module) {
  return {
    pMax: String(module?.pMax ?? 400),
    voc: String(module?.voc ?? 41.2),
    vmp: String(module?.vmp ?? 33.8),
    isc: String(module?.isc ?? 10.2),
    imp: String(module?.imp ?? 9.8),
    tempCoeffVoc: String(module?.tempCoeffVoc ?? -0.27),
    tempCoeffPmax: String(module?.tempCoeffPmax ?? -0.35),
  };
}

function buildInverterForm(inverter) {
  return {
    ratedPowerAC: String(inverter?.ratedPowerAC ?? 100000),
    maxDCPower: String(inverter?.maxDCPower ?? 130000),
    mpptMin: String(inverter?.mpptMin ?? 450),
    mpptMax: String(inverter?.mpptMax ?? 850),
    maxVdc: String(inverter?.maxVdc ?? 1100),
    maxIdc: String(inverter?.maxIdc ?? 200),
    numMPPT: String(inverter?.numMPPT ?? 8),
    maxStringsPerMPPT: String(inverter?.maxStringsPerMPPT ?? 8),
    efficiency: String(inverter?.efficiency ?? 98.5),
  };
}

function coerceModule(formValues) {
  return {
    pMax: toFiniteNumber(formValues?.pMax),
    voc: toFiniteNumber(formValues?.voc),
    vmp: toFiniteNumber(formValues?.vmp),
    isc: toFiniteNumber(formValues?.isc),
    imp: toFiniteNumber(formValues?.imp),
    tempCoeffVoc: toFiniteNumber(formValues?.tempCoeffVoc),
    tempCoeffPmax: toFiniteNumber(formValues?.tempCoeffPmax),
  };
}

function coerceInverter(formValues) {
  return {
    ratedPowerAC: toFiniteNumber(formValues?.ratedPowerAC),
    maxDCPower: toFiniteNumber(formValues?.maxDCPower),
    mpptMin: toFiniteNumber(formValues?.mpptMin),
    mpptMax: toFiniteNumber(formValues?.mpptMax),
    maxVdc: toFiniteNumber(formValues?.maxVdc),
    maxIdc: toFiniteNumber(formValues?.maxIdc),
    numMPPT: toFiniteNumber(formValues?.numMPPT),
    maxStringsPerMPPT: toFiniteNumber(formValues?.maxStringsPerMPPT),
    efficiency: toFiniteNumber(formValues?.efficiency),
  };
}

function getRatioStatus(dcAcRatio) {
  if (dcAcRatio > 1.35) {
    return {
      label: "Too high",
      color: "#A32D2D",
      bg: "#FCEBEB",
      passes: false,
      description: "Clipping risk is elevated above the recommended design range.",
    };
  }

  if (dcAcRatio >= 1.15) {
    return {
      label: "Optimal",
      color: "#1D9E75",
      bg: "#E1F5EE",
      passes: true,
      description: "The inverter loading is in the preferred solar design window.",
    };
  }

  return {
    label: "Acceptable",
    color: "#854F0B",
    bg: "#FAEEDA",
    passes: true,
    description: "The inverter is conservatively sized with lower clipping risk.",
  };
}

function getClippingStyle(clippingLossPct) {
  if (clippingLossPct > 3) {
    return { color: "#A32D2D", bg: "#FCEBEB" };
  }

  if (clippingLossPct >= 1) {
    return { color: "#854F0B", bg: "#FAEEDA" };
  }

  return { color: "#1D9E75", bg: "#E1F5EE" };
}

function buildIssueList({
  stringVmpHot,
  stringVocCold,
  stringCurrent,
  inverter,
  checks,
  ratioStatus,
  dcAcRatio,
}) {
  const issues = [];

  if (!checks.mpptMinOk) {
    issues.push(
      `Hot string Vmp ${formatVoltage(stringVmpHot)} is below MPPT minimum ${formatVoltage(inverter.mpptMin)}.`
    );
  }

  if (!checks.mpptMaxOk) {
    issues.push(
      `Hot string Vmp ${formatVoltage(stringVmpHot)} exceeds MPPT maximum ${formatVoltage(inverter.mpptMax)}.`
    );
  }

  if (!checks.maxVdcOk) {
    issues.push(
      `Cold string Voc ${formatVoltage(stringVocCold)} exceeds the 98% safety limit ${formatVoltage(inverter.maxVdc * 0.98)}.`
    );
  }

  if (!checks.currentOk) {
    issues.push(
      `DC current ${formatNumber(stringCurrent, 1)} A exceeds inverter limit ${formatNumber(inverter.maxIdc, 1)} A.`
    );
  }

  if (!ratioStatus.passes) {
    issues.push(`DC/AC ratio ${formatNumber(dcAcRatio, 2)} is above the recommended maximum 1.35.`);
  }

  return issues;
}

function calculateInverterScenario({
  moduleName,
  inverterName,
  module,
  inverter,
  modulesPerString,
  numStrings,
  hotTemp,
  coldTemp,
  capacityFactor,
}) {
  if (!module || module.pMax <= 0 || module.voc <= 0 || module.vmp <= 0 || module.isc <= 0) {
    throw new Error("Module parameters must be valid positive numbers.");
  }

  if (
    !inverter ||
    inverter.ratedPowerAC <= 0 ||
    inverter.maxDCPower <= 0 ||
    inverter.mpptMax <= 0 ||
    inverter.maxVdc <= 0 ||
    inverter.maxIdc <= 0
  ) {
    throw new Error("Inverter parameters must be valid positive numbers.");
  }

  if (modulesPerString < 1 || numStrings < 1) {
    throw new Error("String layout must include at least one module and one string.");
  }

  const totalModules = modulesPerString * numStrings;
  const systemKwp = (totalModules * module.pMax) / 1000;

  if (systemKwp <= 0) {
    throw new Error("Derived system size must be greater than zero.");
  }

  const inverterKwAC = inverter.ratedPowerAC / 1000;
  const numInverters = Math.max(1, calcNumInverters(systemKwp, inverterKwAC, DESIGN_DC_AC_TARGET));
  const totalACKw = numInverters * inverterKwAC;
  const dcAcRatio = calcDCACRatio(systemKwp, totalACKw);
  const clippingLossPct = estimateClippingLoss(dcAcRatio, capacityFactor);
  const stringConfig = calcStringConfig({
    modulesPerString,
    numStrings,
    module,
    inverter,
    hotTemp,
    coldTemp,
  });
  const ratioStatus = getRatioStatus(dcAcRatio);
  const mpptPass = stringConfig.checks.mpptMinOk && stringConfig.checks.mpptMaxOk;
  const stringCurrent = module.isc * numStrings;
  const issueList = buildIssueList({
    stringVmpHot: stringConfig.stringVmpHot,
    stringVocCold: stringConfig.stringVocCold,
    stringCurrent,
    inverter,
    checks: stringConfig.checks,
    ratioStatus,
    dcAcRatio,
  });

  return {
    moduleName,
    inverterName,
    module,
    inverter,
    modulesPerString,
    numStrings,
    totalModules,
    hotTemp,
    coldTemp,
    capacityFactor,
    systemKwp,
    inverterKwAC,
    numInverters,
    totalACKw,
    dcAcRatio,
    clippingLossPct,
    ratioStatus,
    stringCurrent,
    stringVmpHot: stringConfig.stringVmpHot,
    stringVocCold: stringConfig.stringVocCold,
    checks: stringConfig.checks,
    mpptPass,
    allOk: stringConfig.allOk && ratioStatus.passes,
    issueList,
  };
}

function buildInverterPrompt(results) {
  return [
    "Analyze this PV inverter sizing configuration:",
    `Module: ${results.moduleName}, ${results.modulesPerString} per string,`,
    `${results.numStrings} strings total = ${results.systemKwp.toFixed(1)}kWp`,
    `Inverter: ${results.inverterName} × ${results.numInverters} units`,
    `String Vmp at ${results.hotTemp}°C: ${results.stringVmpHot.toFixed(1)}V`,
    `(MPPT range: ${results.inverter.mpptMin}-${results.inverter.mpptMax}V) → ${results.mpptPass ? "PASS" : "FAIL"}`,
    `String Voc at ${results.coldTemp}°C: ${results.stringVocCold.toFixed(1)}V`,
    `(Max Vdc limit: ${results.inverter.maxVdc}V) → ${results.checks.maxVdcOk ? "PASS" : "FAIL"}`,
    `DC/AC ratio: ${results.dcAcRatio.toFixed(2)} → clipping: ~${results.clippingLossPct.toFixed(1)}%`,
    `All checks: ${results.allOk ? "PASS" : "FAIL"}`,
    "",
    "Provide 3-4 sentences covering:",
    "1. Configuration validity and safety assessment",
    "2. DC/AC ratio optimization (is it optimal for this location?)",
    "3. Most critical check result and its implications",
    "4. One specific design improvement recommendation",
  ].join("\n");
}

function buildInverterPdfData(results, aiAnalysis) {
  return {
    inputs: {
      "Module preset": results.moduleName,
      "Inverter preset": results.inverterName,
      "Modules per string": String(results.modulesPerString),
      "Number of strings": String(results.numStrings),
      "System size": `${results.systemKwp.toFixed(1)} kWp`,
      "Hot module temp": `${results.hotTemp} C`,
      "Cold ambient temp": `${results.coldTemp} C`,
      "Capacity factor": `${results.capacityFactor}%`,
    },
    metrics: [
      { label: "Verdict", value: results.allOk ? "Valid" : "Invalid", unit: "" },
      { label: "DC/AC ratio", value: results.dcAcRatio.toFixed(2), unit: "" },
      { label: "Clipping loss", value: results.clippingLossPct.toFixed(1), unit: "%" },
      { label: "Inverters", value: results.numInverters, unit: "units" },
      { label: "Total AC size", value: results.totalACKw.toFixed(1), unit: "kW" },
    ],
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

function InverterMetricCard({ label, value, unit, accentStyle = null, helper = "" }) {
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

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").replace("#", "");

  if (normalized.length !== 6) {
    return `rgba(15, 23, 42, ${alpha})`;
  }

  const bigint = Number.parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function StatusRow({ label, value, requirement, statusLabel, passes, accentColor = null }) {
  const isPending = statusLabel === "Pending";
  const Icon = isPending ? ExclamationTriangleIcon : passes ? CheckCircleIcon : XCircleIcon;
  const color = isPending ? "#64748B" : accentColor ?? (passes ? "#1D9E75" : "#A32D2D");
  const edgeGlow = isPending ? hexToRgba(color, 0.26) : hexToRgba(color, 0.52);
  const shellBackground = isPending
    ? "linear-gradient(135deg, rgba(21,35,34,0.92) 0%, rgba(32,44,44,0.9) 52%, rgba(17,24,39,0.9) 100%)"
    : `radial-gradient(circle at 16% 18%, ${hexToRgba(color, 0.3)} 0%, rgba(255,255,255,0.08) 24%, rgba(17,29,28,0.92) 100%), linear-gradient(135deg, rgba(20,31,30,0.96) 0%, rgba(26,38,37,0.93) 48%, rgba(12,18,18,0.96) 100%)`;
  const iconBackground = `linear-gradient(180deg, ${hexToRgba(color, 0.22)} 0%, ${hexToRgba(
    color,
    0.08
  )} 100%)`;
  const metaBackground =
    "linear-gradient(180deg, rgba(66, 89, 84, 0.52) 0%, rgba(42, 59, 56, 0.72) 56%, rgba(27, 40, 38, 0.84) 100%)";
  const metaBorder = "1px solid rgba(255,255,255,0.08)";
  const textColor = "rgba(247,250,248,0.98)";
  const mutedText = "rgba(210,222,217,0.78)";
  const metaLabelColor = "rgba(180, 201, 194, 0.72)";
  const metaValueColor = "rgba(245, 250, 247, 0.96)";
  const subtitleText = isPending ? "Technical status pending" : "Technical compliance check";
  const pillBackground = isPending
    ? "linear-gradient(180deg, rgba(100,116,139,0.9) 0%, rgba(71,85,105,0.95) 100%)"
    : `linear-gradient(180deg, ${hexToRgba(color, 0.96)} 0%, ${hexToRgba(color, 0.78)} 100%)`;

  return (
    <div
      className="rounded-[22px] p-[1px]"
      style={{
        background: `linear-gradient(135deg, ${edgeGlow} 0%, rgba(255,255,255,0.12) 28%, rgba(255,255,255,0.04) 100%)`,
        boxShadow: `0 18px 40px ${hexToRgba(color, 0.18)}`,
      }}
    >
      <div
        className="relative overflow-hidden rounded-[21px] px-5 py-5 backdrop-blur-sm sm:px-6"
        style={{ background: shellBackground, border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[4px]"
          style={{ backgroundColor: color }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-6 top-0 h-20 w-32 rounded-full blur-2xl"
          style={{ backgroundColor: hexToRgba(color, 0.2) }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
              style={{ background: iconBackground }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: textColor }}>
                {label}
              </p>
              <p
                className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em]"
                style={{ color }}
              >
                {subtitleText}
              </p>
            </div>
          </div>
          <span
            className="inline-flex shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
            style={{ background: pillBackground, color: "#ffffff" }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-[20px] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(5,12,11,0.18),0_10px_24px_rgba(5,12,11,0.14)]"
            style={{ background: metaBackground, border: metaBorder }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: metaLabelColor }}
            >
              Measured
            </p>
            <p
              className="mt-3 text-lg font-semibold tracking-[-0.03em]"
              style={{ color: metaValueColor }}
            >
              {value}
            </p>
          </div>
          <div
            className="rounded-[20px] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(5,12,11,0.18),0_10px_24px_rgba(5,12,11,0.14)]"
            style={{ background: metaBackground, border: metaBorder }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: metaLabelColor }}
            >
              Required
            </p>
            <p
              className="mt-3 text-lg font-semibold tracking-[-0.03em]"
              style={{ color: metaValueColor }}
            >
              {requirement}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoltageWindow({ results }) {
  const maxVdc = results?.inverter?.maxVdc ?? 1000;
  const mpptMin = results?.inverter?.mpptMin ?? 0;
  const mpptMax = results?.inverter?.mpptMax ?? 0;
  const hotVmp = results?.stringVmpHot ?? 0;
  const coldVoc = results?.stringVocCold ?? 0;
  const safetyLimit = maxVdc * 0.98;

  const position = (value) => {
    if (maxVdc <= 0) {
      return 0;
    }

    return Math.max(0, Math.min((value / maxVdc) * 100, 100));
  };

  const mpptStart = position(mpptMin);
  const mpptWidth = Math.max(position(mpptMax) - mpptStart, 0);

  return (
    <PanelCard className="space-y-4">
      <SectionLabel>Voltage window</SectionLabel>
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
        <svg viewBox="0 0 1000 110" className="h-[60px] w-full">
          <rect x="0" y="42" width="1000" height="18" rx="9" fill="#D7DBD3" opacity="0.7" />
          <rect x={mpptStart * 10} y="42" width={mpptWidth * 10} height="18" rx="9" fill="#5DCAA5" />
          <rect
            x={position(safetyLimit) * 10}
            y="42"
            width={Math.max(1000 - position(safetyLimit) * 10, 0)}
            height="18"
            rx="9"
            fill="#F09595"
            opacity="0.9"
          />

          <line
            x1={position(hotVmp) * 10}
            x2={position(hotVmp) * 10}
            y1="22"
            y2="78"
            stroke="#EF9F27"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1={position(coldVoc) * 10}
            x2={position(coldVoc) * 10}
            y1="16"
            y2="84"
            stroke="#378ADD"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <text x="0" y="102" fontSize="22" fill="#6B7280">0 V</text>
          <text x={mpptStart * 10} y="24" fontSize="20" fill="#1D9E75">{Math.round(mpptMin)} V</text>
          <text
            x={(mpptStart + mpptWidth) * 10}
            y="24"
            textAnchor="end"
            fontSize="20"
            fill="#1D9E75"
          >
            {Math.round(mpptMax)} V
          </text>
          <text
            x={position(safetyLimit) * 10}
            y="102"
            textAnchor="end"
            fontSize="20"
            fill="#A32D2D"
          >
            {Math.round(safetyLimit)} V
          </text>
          <text x="1000" y="102" textAnchor="end" fontSize="22" fill="#6B7280">
            {Math.round(maxVdc)} V
          </text>
        </svg>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="h-3 w-3 rounded-full bg-[#5DCAA5]" />
            <span>MPPT operating zone</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="h-3 w-3 rounded-full bg-[#F09595]" />
            <span>Above 98% Vdc safety margin</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="h-3 w-3 rounded-full bg-[#EF9F27]" />
            <span>String Vmp at hot condition</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="h-3 w-3 rounded-full bg-[#378ADD]" />
            <span>String Voc at cold condition</span>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

export default function InverterSizingTool() {
  const [modulePreset, setModulePreset] = useState("Generic 400W Mono-Si");
  const [customModule, setCustomModule] = useState(
    buildModuleForm(MODULE_PRESETS["Generic 400W Mono-Si"])
  );
  const [modulesPerString, setModulesPerString] = useState(20);
  const [numStrings, setNumStrings] = useState(10);
  const [inverterPreset, setInverterPreset] = useState("Generic 100kW Central");
  const [customInverter, setCustomInverter] = useState(
    buildInverterForm(INVERTER_PRESETS["Generic 100kW Central"])
  );
  const [hotTemp, setHotTemp] = useState(70);
  const [coldTemp, setColdTemp] = useState(-10);
  const [capacityFactor, setCapacityFactor] = useState(20);
  const [results, setResults] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [pdfData, setPdfData] = useState(null);

  const activeModule = useMemo(
    () => (modulePreset === "Custom" ? coerceModule(customModule) : MODULE_PRESETS[modulePreset]),
    [customModule, modulePreset]
  );
  const activeInverter = useMemo(
    () =>
      inverterPreset === "Custom"
        ? coerceInverter(customInverter)
        : INVERTER_PRESETS[inverterPreset],
    [customInverter, inverterPreset]
  );

  const derivedTotalModules = modulesPerString * numStrings;
  const derivedSystemKwp = useMemo(
    () => (derivedTotalModules * activeModule.pMax) / 1000,
    [activeModule.pMax, derivedTotalModules]
  );

  const hasResults = Boolean(results);
  const ratioAccent = hasResults
    ? results.dcAcRatio >= 1.1 && results.dcAcRatio <= 1.35
      ? { color: "#1D9E75", bg: "#E1F5EE" }
      : { color: "#854F0B", bg: "#FAEEDA" }
    : null;
  const clippingAccent = hasResults ? getClippingStyle(results.clippingLossPct) : null;

  function clearComputedState(nextError = "") {
    setResults(null);
    setPdfData(null);
    setAiAnalysis("");
    setError(nextError);
  }

  function handleModulePresetChange(event) {
    const nextPreset = event.target.value;
    clearComputedState();

    if (nextPreset === "Custom") {
      const sourcePreset =
        modulePreset === "Custom" ? activeModule : MODULE_PRESETS[modulePreset];
      setCustomModule(buildModuleForm(sourcePreset));
    }

    setModulePreset(nextPreset);
  }

  function handleInverterPresetChange(event) {
    const nextPreset = event.target.value;
    clearComputedState();

    if (nextPreset === "Custom") {
      const sourcePreset =
        inverterPreset === "Custom" ? activeInverter : INVERTER_PRESETS[inverterPreset];
      setCustomInverter(buildInverterForm(sourcePreset));
    }

    setInverterPreset(nextPreset);
  }

  function handleCustomModuleChange(field, value) {
    clearComputedState();
    setCustomModule((current) => ({ ...current, [field]: value }));
  }

  function handleCustomInverterChange(field, value) {
    clearComputedState();
    setCustomInverter((current) => ({ ...current, [field]: value }));
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
      nextResults = calculateInverterScenario({
        moduleName: modulePreset,
        inverterName: inverterPreset,
        module: activeModule,
        inverter: activeInverter,
        modulesPerString,
        numStrings,
        hotTemp,
        coldTemp,
        capacityFactor,
      });
      setResults(nextResults);
      const nextPdfData = buildInverterPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.inverter,
        createToolReportSnapshot({
          toolName: "Inverter Sizing",
          inputs: {
            modulePreset,
            inverterPreset,
            modulesPerString,
            numStrings,
            hotTemp,
            coldTemp,
            capacityFactor,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setResults(null);
      setError(calculationError.message || "Inverter sizing calculation failed.");
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildInverterPrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildInverterPdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.inverter,
        createToolReportSnapshot({
          toolName: "Inverter Sizing",
          inputs: {
            modulePreset,
            inverterPreset,
            modulesPerString,
            numStrings,
            hotTemp,
            coldTemp,
            capacityFactor,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildInverterPdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.inverter,
        createToolReportSnapshot({
          toolName: "Inverter Sizing",
          inputs: {
            modulePreset,
            inverterPreset,
            modulesPerString,
            numStrings,
            hotTemp,
            coldTemp,
            capacityFactor,
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

  const activeModuleSummary = `${formatNumber(activeModule.pMax, 0)} W | Voc ${formatNumber(
    activeModule.voc,
    1
  )} V | Vmp ${formatNumber(activeModule.vmp, 1)} V`;
  const activeInverterSummary = `${formatPower(
    activeInverter.ratedPowerAC / 1000
  )} AC | ${formatPower(activeInverter.maxDCPower / 1000)} max DC | ${formatNumber(
    activeInverter.numMPPT,
    0
  )} MPPT`;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="teal">New tool</Badge>
          <Badge color="amber">String design</Badge>
          <Badge color="blue">Pure calculation + Gemini</Badge>
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-5xl">
          Inverter Sizing Tool
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
          Size inverter fleets from the actual string layout, check hot and cold voltage
          behavior, validate DC current, and quantify DC/AC oversizing with clipping risk.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-[var(--radius-md)] bg-red-50 px-4 py-3 text-sm text-red-700 [border:1px_solid_rgba(220,38,38,0.15)]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <PanelCard className="space-y-6">
          <div className="space-y-4">
            <SectionLabel>PV module</SectionLabel>
            <SelectField
              label="Module preset"
              value={modulePreset}
              onChange={handleModulePresetChange}
              helper={activeModuleSummary}
              options={Object.keys(MODULE_PRESETS).map((key) => ({
                value: key,
                label: key,
              }))}
            />

            {modulePreset === "Custom" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Pmax (W)"
                  value={customModule.pMax}
                  onChange={(event) => handleCustomModuleChange("pMax", event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Voc (V)"
                  value={customModule.voc}
                  onChange={(event) => handleCustomModuleChange("voc", event.target.value)}
                  min="1"
                  step="0.1"
                />
                <NumberField
                  label="Vmp (V)"
                  value={customModule.vmp}
                  onChange={(event) => handleCustomModuleChange("vmp", event.target.value)}
                  min="1"
                  step="0.1"
                />
                <NumberField
                  label="Isc (A)"
                  value={customModule.isc}
                  onChange={(event) => handleCustomModuleChange("isc", event.target.value)}
                  min="0.1"
                  step="0.1"
                />
                <NumberField
                  label="Imp (A)"
                  value={customModule.imp}
                  onChange={(event) => handleCustomModuleChange("imp", event.target.value)}
                  min="0.1"
                  step="0.1"
                />
                <NumberField
                  label="Temp coefficient Voc (%/C)"
                  value={customModule.tempCoeffVoc}
                  onChange={(event) => handleCustomModuleChange("tempCoeffVoc", event.target.value)}
                  step="0.01"
                />
              </div>
            ) : null}

            <SliderField
              label="Modules per string"
              min={5}
              max={40}
              step={1}
              value={modulesPerString}
              onChange={(event) => handleSliderChange(setModulesPerString, event.target.value)}
              displayValue={modulesPerString}
            />

            <SliderField
              label="Number of strings"
              min={1}
              max={100}
              step={1}
              value={numStrings}
              onChange={(event) => handleSliderChange(setNumStrings, event.target.value)}
              displayValue={numStrings}
            />
          </div>

          <div className="space-y-4">
            <SectionLabel>Inverter</SectionLabel>
            <SelectField
              label="Inverter preset"
              value={inverterPreset}
              onChange={handleInverterPresetChange}
              helper={activeInverterSummary}
              options={Object.keys(INVERTER_PRESETS).map((key) => ({
                value: key,
                label: key,
              }))}
            />

            {inverterPreset === "Custom" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Rated AC power (W)"
                  value={customInverter.ratedPowerAC}
                  onChange={(event) =>
                    handleCustomInverterChange("ratedPowerAC", event.target.value)
                  }
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Max DC power (W)"
                  value={customInverter.maxDCPower}
                  onChange={(event) =>
                    handleCustomInverterChange("maxDCPower", event.target.value)
                  }
                  min="1"
                  step="1"
                />
                <NumberField
                  label="MPPT min voltage (V)"
                  value={customInverter.mpptMin}
                  onChange={(event) => handleCustomInverterChange("mpptMin", event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="MPPT max voltage (V)"
                  value={customInverter.mpptMax}
                  onChange={(event) => handleCustomInverterChange("mpptMax", event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Max DC voltage (V)"
                  value={customInverter.maxVdc}
                  onChange={(event) => handleCustomInverterChange("maxVdc", event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Max DC current (A)"
                  value={customInverter.maxIdc}
                  onChange={(event) => handleCustomInverterChange("maxIdc", event.target.value)}
                  min="0.1"
                  step="0.1"
                />
                <NumberField
                  label="Number of MPPTs"
                  value={customInverter.numMPPT}
                  onChange={(event) => handleCustomInverterChange("numMPPT", event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Efficiency (%)"
                  value={customInverter.efficiency}
                  onChange={(event) =>
                    handleCustomInverterChange("efficiency", event.target.value)
                  }
                  min="90"
                  max="100"
                  step="0.1"
                />
              </div>
            ) : null}

            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 text-sm leading-6 text-[var(--color-text-muted)] [border:var(--border-default)]">
              This version keeps `max DC power`, `MPPT count`, and `max strings per MPPT` as
              design metadata. The compliance verdict uses the four requested checks only.
            </div>
          </div>

          <div className="space-y-4">
            <SectionLabel>Site temperatures</SectionLabel>
            <SliderField
              label="Max module temperature (hot day)"
              min={50}
              max={85}
              step={1}
              value={hotTemp}
              onChange={(event) => handleSliderChange(setHotTemp, event.target.value)}
              displayValue={`${hotTemp} C`}
            />
            <p className="-mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Module temp = ambient + 25-30C
            </p>

            <SliderField
              label="Min ambient temperature (cold day)"
              min={-25}
              max={10}
              step={1}
              value={coldTemp}
              onChange={(event) => handleSliderChange(setColdTemp, event.target.value)}
              displayValue={`${coldTemp} C`}
            />
          </div>

          <div className="space-y-4">
            <SectionLabel>System</SectionLabel>
            <SliderField
              label="Location capacity factor"
              min={10}
              max={35}
              step={1}
              value={capacityFactor}
              onChange={(event) => handleSliderChange(setCapacityFactor, event.target.value)}
              displayValue={`${capacityFactor}%`}
            />

            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-4 [border:var(--border-default)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Derived system size
              </p>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-3xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
                  {formatNumber(derivedSystemKwp, 1)}
                </span>
                <span className="pb-1 text-sm font-medium text-[var(--color-text-muted)]">
                  kWp DC
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                {formatNumber(derivedTotalModules, 0)} modules from {modulesPerString} modules/string
                × {numStrings} strings.
              </p>
            </div>
          </div>

          <ActionButton onClick={handleCalculate} loading={loadingAI}>
            Check configuration
          </ActionButton>
        </PanelCard>

        <div className="space-y-6">
          <PanelCard
            className="space-y-4"
            style={
              hasResults
                ? {
                    backgroundColor: results.allOk ? "#E1F5EE" : "#FCEBEB",
                    border: `1px solid ${results.allOk ? "#1D9E75" : "#A32D2D"}`,
                    color: results.allOk ? "#085041" : "#791F1F",
                  }
                : undefined
            }
          >
            <SectionLabel>Configuration verdict</SectionLabel>
            {hasResults ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {results.allOk ? (
                    <CheckCircleIcon className="mt-1 h-6 w-6 shrink-0" />
                  ) : (
                    <ExclamationTriangleIcon className="mt-1 h-6 w-6 shrink-0" />
                  )}
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                      {results.allOk
                        ? "Configuration Valid"
                        : `Configuration Invalid - ${results.issueList.length} issues detected`}
                    </h2>
                    <p className="text-sm leading-6 opacity-85">
                      {results.modulesPerString} modules × {results.numStrings} strings →{" "}
                      {results.systemKwp.toFixed(1)}kWp with {results.numInverters}×{" "}
                      {results.inverterName}
                    </p>
                  </div>
                </div>

                {!results.allOk ? (
                  <ul className="space-y-2 text-sm leading-6">
                    {results.issueList.map((issue) => (
                      <li key={issue} className="flex items-start gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-current" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Configure the module, inverter, and string layout to see the hot/cold voltage
                checks, DC/AC ratio verdict, and fleet sizing outcome.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Check results</SectionLabel>
            <div className="space-y-3">
              <StatusRow
                label="MPPT voltage (hot)"
                value={hasResults ? formatVoltage(results.stringVmpHot) : "--"}
                requirement={
                  hasResults
                    ? `${formatVoltage(results.inverter.mpptMin)} - ${formatVoltage(
                        results.inverter.mpptMax
                      )}`
                    : "--"
                }
                statusLabel={hasResults ? (results.mpptPass ? "PASS" : "FAIL") : "Pending"}
                passes={hasResults ? results.mpptPass : false}
              />
              <StatusRow
                label="Max DC voltage (cold)"
                value={hasResults ? formatVoltage(results.stringVocCold) : "--"}
                requirement={
                  hasResults
                    ? `< ${formatVoltage(results.inverter.maxVdc * 0.98)}`
                    : "--"
                }
                statusLabel={hasResults ? (results.checks.maxVdcOk ? "PASS" : "FAIL") : "Pending"}
                passes={hasResults ? results.checks.maxVdcOk : false}
              />
              <StatusRow
                label="Max DC current"
                value={hasResults ? `${formatNumber(results.stringCurrent, 1)} A` : "--"}
                requirement={
                  hasResults ? `< ${formatNumber(results.inverter.maxIdc, 1)} A` : "--"
                }
                statusLabel={hasResults ? (results.checks.currentOk ? "PASS" : "FAIL") : "Pending"}
                passes={hasResults ? results.checks.currentOk : false}
              />
              <StatusRow
                label="DC/AC ratio"
                value={hasResults ? formatNumber(results.dcAcRatio, 2) : "--"}
                requirement="Optimal range: 1.15 - 1.35"
                statusLabel={hasResults ? results.ratioStatus.label : "Pending"}
                passes={hasResults ? results.ratioStatus.passes : false}
                accentColor={hasResults ? results.ratioStatus.color : "#64748B"}
              />
            </div>
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <InverterMetricCard
              label="DC/AC ratio"
              value={hasResults ? formatNumber(results.dcAcRatio, 2) : "--"}
              unit=""
              accentStyle={ratioAccent}
              helper={hasResults ? results.ratioStatus.description : ""}
            />
            <InverterMetricCard
              label="Clipping loss"
              value={hasResults ? formatNumber(results.clippingLossPct, 1) : "--"}
              unit="%"
              accentStyle={clippingAccent}
              helper={hasResults ? "Estimated from the final fleet DC/AC ratio." : ""}
            />
            <InverterMetricCard
              label="Inverters needed"
              value={hasResults ? formatNumber(results.numInverters, 0) : "--"}
              unit="units"
            />
            <InverterMetricCard
              label="Total system DC power"
              value={hasResults ? formatNumber(results.systemKwp, 1) : formatNumber(derivedSystemKwp, 1)}
              unit="kWp"
            />
          </div>

          <VoltageWindow results={results} />

          <PanelCard className="space-y-4">
            <SectionLabel>String layout summary</SectionLabel>
            {hasResults ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 text-sm leading-7 text-[var(--color-text)] [border:var(--border-default)]">
                <p>
                  String layout:
                  <br />
                  {results.modulesPerString} modules/string × {results.numStrings} strings
                  <br />= {results.totalModules} total modules
                  <br />= {results.systemKwp.toFixed(1)} kWp DC
                  <br />→ {results.numInverters} × {formatNumber(results.inverterKwAC, 0)}kW
                  inverter(s)
                  <br />= {results.totalACKw.toFixed(1)} kW AC
                  <br />
                  DC/AC ratio: {results.dcAcRatio.toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Run the configuration check to generate the final string layout and inverter fleet
                summary.
              </p>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Next step</SectionLabel>
            <div className="grid gap-3">
              {NEXT_STEP_TOOLS.map((tool) => {
                const Icon = tool.Icon;

                return (
                  <Link
                    key={tool.name}
                    href={tool.href}
                    className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-brand-light)] text-[var(--color-brand)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRightIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
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
                description="Add inverter compliance, clipping risk, and fleet sizing into one final project report."
              />
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is reviewing the inverter configuration..." />
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
                Check the configuration to generate an engineering review of voltage safety,
                inverter loading, and improvement priorities.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Inverter Sizing"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
        </div>
      </div>
    </section>
  );
}
