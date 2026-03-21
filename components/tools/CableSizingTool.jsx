import { useState } from "react";
import {
  ActionButton,
  ExportButton,
  MetricCard,
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
  AMPACITY_TABLE,
  STANDARD_SIZES_MM2,
  VD_LIMITS,
  calcAnnualEnergyLoss,
  calcCurrent,
  calcMinCrossSectionVD,
  calcPowerLoss,
  calcVoltageDrop,
  calcVoltageDropPct,
  findRecommendedSize,
  getGroupingFactor,
  getTempCorrectionFactor,
} from "../../lib/cableCalc";

const DC_VOLTAGES = [12, 24, 48, 96, 120, 240, 380, 600, 1000, 1500];
const AC_SINGLE_PHASE_VOLTAGES = [120, 230, 240];
const AC_THREE_PHASE_VOLTAGES = [208, 380, 400, 415, 480, 690];
const AMBIENT_OPTIONS = [25, 30, 35, 40, 45, 50, 55];
const BUNDLE_OPTIONS = [1, 2, 3, 4, 5, 6];

const APPLICATION_OPTIONS = {
  dc: [
    { value: "pv_dc", label: "PV String DC", standard: "IEC 60364", limit: VD_LIMITS.pv_dc },
    { value: "pv_dc_main", label: "PV Main DC Cable", standard: "IEC 60364", limit: VD_LIMITS.pv_dc_main },
  ],
  ac: [
    { value: "ac_final", label: "AC Final Circuit", standard: "IEC 60364", limit: VD_LIMITS.ac_final },
    { value: "ac_distribution", label: "AC Distribution", standard: "IEC 60364", limit: VD_LIMITS.ac_distribution },
    { value: "motor", label: "Motor Circuit", standard: "IEC 60364", limit: VD_LIMITS.motor },
  ],
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatNumber(value, maximumFractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function formatPower(power) {
  if (power < 1000) {
    return `${Math.round(power)} W`;
  }

  return `${(power / 1000).toFixed(1)} kW`;
}

function formatSize(size) {
  if (!Number.isFinite(size)) {
    return "--";
  }

  return Number.isInteger(size) ? String(size) : size.toFixed(1);
}

function titleCase(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getVoltageOptions(systemType, phases) {
  if (systemType === "dc") {
    return DC_VOLTAGES;
  }

  return phases === 3 ? AC_THREE_PHASE_VOLTAGES : AC_SINGLE_PHASE_VOLTAGES;
}

function getApplicationMeta(systemType, applicationType) {
  return (APPLICATION_OPTIONS[systemType] || []).find((item) => item.value === applicationType);
}

function getAmpacity(size, conductorMaterial, insulationType) {
  const key = `${conductorMaterial}_${insulationType}`;
  return AMPACITY_TABLE[size]?.[key] ?? null;
}

function getNextStandardSize(requiredSize) {
  return (
    STANDARD_SIZES_MM2.find((size) => size >= requiredSize) ??
    STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1]
  );
}

function evaluateCableSize(
  size,
  {
    current,
    voltage,
    cableLength,
    conductorMaterial,
    insulationType,
    systemType,
    phases,
    maxVoltageDropPct,
    operatingHours,
    tempFactor,
    groupFactor,
  }
) {
  const ampacity = getAmpacity(size, conductorMaterial, insulationType);
  const deratedAmpacity = ampacity ? Math.round(ampacity * tempFactor * groupFactor) : null;
  const voltageDrop = calcVoltageDrop(current, cableLength, size, conductorMaterial, systemType, phases);
  const voltageDropPct = calcVoltageDropPct(voltageDrop, voltage);
  const powerLoss = calcPowerLoss(current, cableLength, size, conductorMaterial, systemType, phases);
  const annualEnergyLoss = calcAnnualEnergyLoss(powerLoss, operatingHours);
  const ampacityCompliant = deratedAmpacity !== null && deratedAmpacity >= current;
  const voltageDropCompliant = voltageDropPct <= maxVoltageDropPct;

  return {
    size,
    ampacity,
    deratedAmpacity,
    voltageDrop,
    voltageDropPct,
    powerLoss,
    annualEnergyLoss,
    ampacityCompliant,
    voltageDropCompliant,
    isCompliant: ampacityCompliant && voltageDropCompliant,
  };
}

function buildComparisonRows(params, recommendedSize) {
  const comparisonLimit = Math.min(recommendedSize * 2, STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1]);

  return STANDARD_SIZES_MM2.filter((size) => size >= 2.5 && size <= comparisonLimit).map((size) => {
    const evaluation = evaluateCableSize(size, params);

    return {
      ...evaluation,
      isRecommended: size === recommendedSize,
      isOversized: size > recommendedSize,
      complianceLabel: evaluation.isCompliant ? "Compliant" : "Not compliant",
    };
  });
}

function buildCostHint(comparisonRows, recommendedSize) {
  const recommendedIndex = STANDARD_SIZES_MM2.indexOf(recommendedSize);
  const smallerCompliant = comparisonRows.filter((row) => row.size < recommendedSize && row.isCompliant);

  if (!smallerCompliant.length) {
    return "";
  }

  const bestSmaller = smallerCompliant.find(
    (row) => recommendedIndex - STANDARD_SIZES_MM2.indexOf(row.size) >= 2
  );

  if (!bestSmaller) {
    return "";
  }

  const smallerIndex = STANDARD_SIZES_MM2.indexOf(bestSmaller.size);

  if (recommendedIndex - smallerIndex < 2) {
    return "";
  }

  return `${formatSize(bestSmaller.size)} mm2 still meets ampacity and voltage-drop requirements. Consider ${formatSize(bestSmaller.size)} mm2 to reduce material cost.`;
}

function calculateCableScenario({
  systemType,
  phases,
  power,
  voltage,
  powerFactor,
  cableLength,
  conductorMaterial,
  insulationType,
  ambientTemp,
  numCablesInBundle,
  maxVoltageDropPct,
  operatingHours,
  applicationType,
}) {
  const current = calcCurrent({
    systemType,
    power,
    voltage,
    powerFactor,
    phases,
  });
  const tempFactor = getTempCorrectionFactor(ambientTemp, insulationType);
  const groupFactor = getGroupingFactor(numCablesInBundle);
  const combinedDerating = tempFactor * groupFactor;
  const minCrossSectionVD = calcMinCrossSectionVD(
    current,
    cableLength,
    maxVoltageDropPct,
    voltage,
    conductorMaterial,
    systemType,
    phases
  );
  const minVoltageDropSize = getNextStandardSize(minCrossSectionVD);
  const ampacitySelection = findRecommendedSize(
    current,
    conductorMaterial,
    insulationType,
    ambientTemp,
    numCablesInBundle
  );
  const ampacitySize = ampacitySelection?.size ?? STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1];

  let recommendedSize = Math.max(minVoltageDropSize, ampacitySize);
  let needsParallelOrHigherVoltage =
    !ampacitySelection || minCrossSectionVD > STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1];

  if (recommendedSize > STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1]) {
    recommendedSize = STANDARD_SIZES_MM2[STANDARD_SIZES_MM2.length - 1];
    needsParallelOrHigherVoltage = true;
  }

  const baseParams = {
    current,
    voltage,
    cableLength,
    conductorMaterial,
    insulationType,
    systemType,
    phases,
    maxVoltageDropPct,
    operatingHours,
    tempFactor,
    groupFactor,
  };

  const selected = evaluateCableSize(recommendedSize, baseParams);
  const comparisonRows = buildComparisonRows(baseParams, recommendedSize);
  const ampacityMargin = selected.deratedAmpacity && current > 0 ? selected.deratedAmpacity / current : 0;
  const isCompliant =
    !needsParallelOrHigherVoltage && selected.ampacityCompliant && selected.voltageDropCompliant;
  const isBorderline =
    isCompliant &&
    (selected.voltageDropPct >= maxVoltageDropPct * 0.8 || ampacityMargin < 1.1);
  const aluminumSmallSizeWarning = conductorMaterial === "aluminum" && recommendedSize < 16;
  const costHint = buildCostHint(comparisonRows, recommendedSize);

  return {
    systemType,
    phases,
    power,
    voltage,
    powerFactor,
    cableLength,
    conductorMaterial,
    insulationType,
    ambientTemp,
    numCablesInBundle,
    maxVoltageDropPct,
    operatingHours,
    applicationType,
    current,
    recommendedSize,
    ampacity: selected.ampacity,
    deratedAmpacity: selected.deratedAmpacity,
    tempFactor,
    groupFactor,
    combinedDerating,
    voltageDrop: selected.voltageDrop,
    voltageDropPct: selected.voltageDropPct,
    powerLoss: selected.powerLoss,
    annualEnergyLoss: selected.annualEnergyLoss,
    vdLimit: maxVoltageDropPct,
    comparisonRows,
    minVoltageDropSize,
    ampacitySize,
    isCompliant,
    isBorderline,
    needsParallelOrHigherVoltage,
    aluminumSmallSizeWarning,
    costHint,
  };
}

function buildCablePrompt(results) {
  const phaseLabel = results.systemType === "ac" ? `${results.phases === 3 ? "3" : "1"}-phase` : "";
  const systemDescriptor =
    results.systemType === "ac" ? `AC ${phaseLabel}` : "DC";
  const applicationLabel =
    getApplicationMeta(results.systemType, results.applicationType)?.label ||
    titleCase(results.applicationType);
  const powerFactorLine = results.systemType === "ac" ? `Power factor: ${results.powerFactor.toFixed(2)}\n` : "";
  const lossPercent = results.power > 0 ? (results.powerLoss / results.power) * 100 : 0;

  return `Analyze this cable sizing calculation for a renewable energy system:
System: ${systemDescriptor}, ${Math.round(results.power)}W at ${results.voltage}V
${powerFactorLine}Cable: ${results.cableLength}m, ${titleCase(results.conductorMaterial)} ${results.insulationType.toUpperCase()},
${formatSize(results.recommendedSize)}mm2 selected
Load current: ${results.current.toFixed(1)}A, Cable ampacity: ${results.deratedAmpacity ?? "--"}A
Voltage drop: ${results.voltageDropPct.toFixed(2)}% (IEC limit: ${results.vdLimit.toFixed(1)}%)
Power loss: ${results.powerLoss.toFixed(1)}W (${lossPercent.toFixed(2)}% of load)
Annual energy loss: ${results.annualEnergyLoss.toFixed(0)}kWh/year
Ambient temp: ${results.ambientTemp}C, Cables in bundle: ${results.numCablesInBundle}
Application: ${applicationLabel}

Provide 3-4 sentences covering:
1. Compliance assessment and safety margin
2. Whether a smaller or larger size would be more economical
3. Derating impact and any installation recommendations
4. One optimization tip (e.g. split into parallel cables, use aluminum instead of copper, increase voltage)
Be technical, precise, reference IEC 60364 where relevant.`;
}

function buildCablePdfData(results, aiAnalysis) {
  const chartSizes = STANDARD_SIZES_MM2.filter((size) => size >= 2.5 && size <= results.recommendedSize * 2);
  const applicationLabel =
    getApplicationMeta(results.systemType, results.applicationType)?.label ||
    titleCase(results.applicationType);

  return {
    inputs: {
      "System type":
        results.systemType.toUpperCase() + (results.systemType === "ac" ? ` ${results.phases}-phase` : ""),
      Power: formatPower(results.power),
      Voltage: `${results.voltage} V`,
      "Power factor": results.systemType === "ac" ? results.powerFactor.toFixed(2) : "N/A",
      "Cable length": `${results.cableLength} m`,
      Conductor: `${titleCase(results.conductorMaterial)} / ${results.insulationType.toUpperCase()}`,
      "Ambient temp": `${results.ambientTemp}C`,
      "Cables in bundle": String(results.numCablesInBundle),
      Application: applicationLabel,
      "VD limit": `${results.vdLimit.toFixed(1)}%`,
      "Operating hours": `${results.operatingHours} h/year`,
    },
    metrics: [
      { label: "Recommended size", value: formatSize(results.recommendedSize), unit: "mm2" },
      { label: "Load current", value: results.current.toFixed(1), unit: "A" },
      { label: "Voltage drop", value: results.voltageDropPct.toFixed(2), unit: "%" },
      { label: "Annual energy loss", value: results.annualEnergyLoss.toFixed(0), unit: "kWh/year" },
    ],
    monthlyData: chartSizes.map((size) =>
      Number(
        calcVoltageDropPct(
          calcVoltageDrop(
            results.current,
            results.cableLength,
            size,
            results.conductorMaterial,
            results.systemType,
            results.phases
          ),
          results.voltage
        ).toFixed(2)
      )
    ),
    monthlyLabels: chartSizes.map((size) => `${formatSize(size)}mm2`),
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

function ToggleButtonGroup({ options, value, onChange, columns = 2 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[48px] rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition-colors duration-200",
              isActive
                ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
                : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CableMetricCard({ label, value, unit, variant = "default" }) {
  const variantClasses = {
    default: "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]",
    blue: "bg-[#E6F1FB] text-[#185FA5] dark:bg-[rgba(24,95,165,0.18)] dark:text-[#BBD4EE]",
    green: "bg-[var(--color-brand)] text-[var(--color-inverse)]",
    red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  };
  const metaClasses =
    variant === "default"
      ? "text-[var(--color-text-muted)]"
      : variant === "green"
        ? "text-white/75"
        : "text-current/80";

  return (
    <div className={cn("rounded-[var(--radius-lg)] p-5", variantClasses[variant])}>
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

function RecommendationBanner({ results }) {
  if (!results) {
    return (
      <PanelCard className="space-y-2 bg-[var(--color-surface-secondary)]">
        <SectionLabel>Recommendation</SectionLabel>
        <p className="text-sm leading-7 text-[var(--color-text-muted)]">
          Run the sizing calculation to generate a compliant cable recommendation and voltage-drop check.
        </p>
      </PanelCard>
    );
  }

  const variantClasses = results.needsParallelOrHigherVoltage
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200"
    : results.isBorderline
      ? "border-[var(--badge-amber-border)] bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]"
      : "border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]";

  const heading = results.needsParallelOrHigherVoltage
    ? `Increase beyond ${formatSize(results.recommendedSize)} mm2 or use parallel runs`
    : results.isBorderline
      ? `Warning: ${formatSize(results.recommendedSize)} mm2 is close to the design limit`
      : `Recommended: ${formatSize(results.recommendedSize)} mm2 ${titleCase(results.conductorMaterial)} ${results.insulationType.toUpperCase()}`;

  const detail = results.needsParallelOrHigherVoltage
    ? `Voltage drop ${results.voltageDropPct.toFixed(2)}% exceeds the ${results.vdLimit.toFixed(1)}% limit. Parallel cables or a higher system voltage are required.`
    : `Voltage drop: ${results.voltageDropPct.toFixed(2)}% (${results.vdLimit.toFixed(1)}% limit)  Current: ${results.current.toFixed(1)}A  Ampacity: ${results.deratedAmpacity ?? "--"}A`;

  return (
    <div className={cn("rounded-[var(--radius-lg)] border px-5 py-5", variantClasses)}>
      <SectionLabel>Recommendation</SectionLabel>
      <p className="mt-2 text-base font-semibold">{heading}</p>
      <p className="mt-2 text-sm leading-7">{detail}</p>
    </div>
  );
}

export default function CableSizingTool() {
  const [systemType, setSystemType] = useState("dc");
  const [phases, setPhases] = useState(1);
  const [power, setPower] = useState(5000);
  const [voltage, setVoltage] = useState(48);
  const [powerFactor, setPowerFactor] = useState(0.85);
  const [cableLength, setCableLength] = useState(20);
  const [conductorMaterial, setConductorMaterial] = useState("copper");
  const [insulationType, setInsulationType] = useState("xlpe");
  const [ambientTemp, setAmbientTemp] = useState(30);
  const [numCablesInBundle, setNumCablesInBundle] = useState(1);
  const [applicationType, setApplicationType] = useState("pv_dc");
  const [maxVoltageDropPct, setMaxVoltageDropPct] = useState(VD_LIMITS.pv_dc);
  const [operatingHours, setOperatingHours] = useState(2000);
  const [results, setResults] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");

  const currentPreview = calcCurrent({ systemType, power, voltage, powerFactor, phases });
  const bundleFactor = getGroupingFactor(numCablesInBundle);
  const voltageOptions = getVoltageOptions(systemType, phases);
  const activeApplications = APPLICATION_OPTIONS[systemType];
  const activeApplicationMeta = getApplicationMeta(systemType, applicationType) || activeApplications[0];
  const hasResults = Boolean(results);

  function handleSystemTypeChange(nextSystemType) {
    setSystemType(nextSystemType);
    setResults(null);
    setPdfData(null);
    setAiAnalysis("");
    setError("");

    if (nextSystemType === "dc") {
      setPhases(1);
      setVoltage(48);
      setApplicationType("pv_dc");
      setMaxVoltageDropPct(VD_LIMITS.pv_dc);
      return;
    }

    setPhases(1);
    setVoltage(230);
    setApplicationType("ac_final");
    setMaxVoltageDropPct(VD_LIMITS.ac_final);
  }

  function handlePhasesChange(nextPhases) {
    const numericPhases = Number(nextPhases);
    setPhases(numericPhases);
    setResults(null);
    setPdfData(null);
    setAiAnalysis("");
    setError("");
    setVoltage(numericPhases === 3 ? 400 : 230);
  }

  function handleApplicationChange(nextApplicationType) {
    setApplicationType(nextApplicationType);
    setMaxVoltageDropPct(VD_LIMITS[nextApplicationType]);
    setResults(null);
    setPdfData(null);
    setAiAnalysis("");
    setError("");
  }

  async function handleCalculate() {
    setError("");
    setAiAnalysis("");
    setPdfData(null);

    let nextResults;

    try {
      nextResults = calculateCableScenario({
        systemType,
        phases,
        power,
        voltage,
        powerFactor,
        cableLength,
        conductorMaterial,
        insulationType,
        ambientTemp,
        numCablesInBundle,
        maxVoltageDropPct,
        operatingHours,
        applicationType,
      });

      setResults(nextResults);
      const nextPdfData = buildCablePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.cable,
        createToolReportSnapshot({
          toolName: "Cable Sizing Calculator",
          inputs: {
            systemType,
            phases,
            power,
            voltage,
            powerFactor,
            cableLength,
            conductorMaterial,
            insulationType,
            ambientTemp,
            numCablesInBundle,
            maxVoltageDropPct,
            operatingHours,
            applicationType,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );
    } catch (calculationError) {
      setError(calculationError.message || "Cable sizing calculation failed.");
      setResults(null);
      return;
    }

    setLoadingAI(true);

    try {
      const analysis = await callGemini(buildCablePrompt(nextResults));
      setAiAnalysis(analysis);
      const nextPdfData = buildCablePdfData(nextResults, analysis);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.cable,
        createToolReportSnapshot({
          toolName: "Cable Sizing Calculator",
          inputs: {
            systemType,
            phases,
            power,
            voltage,
            powerFactor,
            cableLength,
            conductorMaterial,
            insulationType,
            ambientTemp,
            numCablesInBundle,
            maxVoltageDropPct,
            operatingHours,
            applicationType,
          },
          results: nextResults,
          pdfData: nextPdfData,
          aiAnalysis: analysis,
        })
      );
    } catch (aiError) {
      setError("AI analysis failed. Results are still available.");
      const nextPdfData = buildCablePdfData(nextResults, "");
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.cable,
        createToolReportSnapshot({
          toolName: "Cable Sizing Calculator",
          inputs: {
            systemType,
            phases,
            power,
            voltage,
            powerFactor,
            cableLength,
            conductorMaterial,
            insulationType,
            ambientTemp,
            numCablesInBundle,
            maxVoltageDropPct,
            operatingHours,
            applicationType,
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
    <section className="mx-auto max-w-7xl pb-16 pt-2 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Cable Sizing Calculator
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">
          Size DC and AC conductors using IEC-style voltage-drop and ampacity checks, derating
          factors, and annual energy loss.
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
            <SectionLabel>System configuration</SectionLabel>
            <div className="space-y-2">
              <SectionLabel>System type</SectionLabel>
              <ToggleButtonGroup
                options={[
                  { value: "dc", label: "DC" },
                  { value: "ac", label: "AC" },
                ]}
                value={systemType}
                onChange={handleSystemTypeChange}
              />
            </div>

            {systemType === "ac" ? (
              <div className="space-y-2">
                <SectionLabel>Phases</SectionLabel>
                <ToggleButtonGroup
                  options={[
                    { value: 1, label: "Single-phase" },
                    { value: 3, label: "Three-phase" },
                  ]}
                  value={phases}
                  onChange={handlePhasesChange}
                />
              </div>
            ) : null}

            <SliderField
              label="Power"
              min={100}
              max={500000}
              step={100}
              value={power}
              onChange={(event) => setPower(Number(event.target.value))}
              displayValue={formatPower(power)}
            />

            <label className="flex flex-col gap-2">
              <SectionLabel>System voltage</SectionLabel>
              <select
                value={voltage}
                onChange={(event) => setVoltage(Number(event.target.value))}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {voltageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} V
                  </option>
                ))}
              </select>
            </label>

            {systemType === "ac" ? (
              <SliderField
                label="Power factor"
                min={0.7}
                max={1}
                step={0.01}
                value={powerFactor}
                onChange={(event) => setPowerFactor(Number(event.target.value))}
                displayValue={`${powerFactor.toFixed(2)} PF`}
              />
            ) : null}

            <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 text-sm text-[var(--color-text-muted)] [border:var(--border-default)]">
              Estimated load current:{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {currentPreview.toFixed(1)} A
              </span>
            </p>
          </div>

          <div className="space-y-5">
            <SectionLabel>Cable parameters</SectionLabel>
            <SliderField
              label="Cable length"
              min={1}
              max={2000}
              step={1}
              value={cableLength}
              onChange={(event) => setCableLength(Number(event.target.value))}
              displayValue={`${cableLength} m`}
            />

            <div className="space-y-2">
              <SectionLabel>Conductor material</SectionLabel>
              <ToggleButtonGroup
                options={[
                  { value: "copper", label: "Copper" },
                  { value: "aluminum", label: "Aluminum" },
                ]}
                value={conductorMaterial}
                onChange={setConductorMaterial}
              />
            </div>

            <label className="flex flex-col gap-2">
              <SectionLabel>Insulation type</SectionLabel>
              <select
                value={insulationType}
                onChange={(event) => setInsulationType(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                <option value="pvc">PVC (max 70C)</option>
                <option value="xlpe">XLPE / EPR (max 90C)</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <SectionLabel>Ambient temperature</SectionLabel>
              <select
                value={ambientTemp}
                onChange={(event) => setAmbientTemp(Number(event.target.value))}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {AMBIENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}C
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <SectionLabel>Cables in bundle</SectionLabel>
              <select
                value={numCablesInBundle}
                onChange={(event) => setNumCablesInBundle(Number(event.target.value))}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {BUNDLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 6 ? "6+" : option}
                  </option>
                ))}
              </select>
              <p className="text-sm text-[var(--color-text-muted)]">
                Grouping factor: {bundleFactor.toFixed(2)}
              </p>
            </label>
          </div>

          <div className="space-y-5">
            <SectionLabel>Standards & application</SectionLabel>
            <label className="flex flex-col gap-2">
              <SectionLabel>Application type</SectionLabel>
              <select
                value={applicationType}
                onChange={(event) => handleApplicationChange(event.target.value)}
                className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {activeApplications.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-[var(--color-text-muted)]">
                {activeApplicationMeta?.standard} limit:{" "}
                {(VD_LIMITS[applicationType] ?? maxVoltageDropPct).toFixed(1)}%
              </p>
            </label>

            <SliderField
              label="Max voltage drop override"
              min={0.5}
              max={5}
              step={0.1}
              value={maxVoltageDropPct}
              onChange={(event) => setMaxVoltageDropPct(Number(event.target.value))}
              displayValue={`${maxVoltageDropPct.toFixed(1)}%`}
            />

            <SliderField
              label="Annual operating hours"
              min={500}
              max={8760}
              step={100}
              value={operatingHours}
              onChange={(event) => setOperatingHours(Number(event.target.value))}
              displayValue={`${operatingHours} h`}
            />
          </div>

          <div className="space-y-3">
            <ActionButton onClick={handleCalculate} loading={loadingAI} variant="primary">
              Calculate
            </ActionButton>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing cable compliance..." />
            ) : null}
          </div>
        </PanelCard>

        <div className="space-y-6">
          <RecommendationBanner results={results} />

          <div className="grid gap-4 sm:grid-cols-2">
            <CableMetricCard
              label="Load current"
              value={hasResults ? formatNumber(results.current, 1) : "--"}
              unit="A"
              variant="blue"
            />
            <CableMetricCard
              label="Voltage drop"
              value={hasResults ? formatNumber(results.voltageDropPct, 2) : "--"}
              unit="%"
              variant={
                hasResults && results.isCompliant ? "green" : hasResults ? "red" : "default"
              }
            />
            <MetricCard
              label="Power loss"
              value={hasResults ? formatNumber(results.powerLoss, 1) : "--"}
              unit="W"
            />
            <MetricCard
              label="Annual energy loss"
              value={hasResults ? formatNumber(results.annualEnergyLoss, 0) : "--"}
              unit="kWh/year"
            />
          </div>

          <PanelCard className="space-y-4">
            <SectionLabel>Cable comparison</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-[12px]">
                <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-3 py-3 font-medium">Size</th>
                    <th className="px-3 py-3 font-medium">Ampacity</th>
                    <th className="px-3 py-3 font-medium">VD%</th>
                    <th className="px-3 py-3 font-medium">Power loss</th>
                    <th className="px-3 py-3 font-medium">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {hasResults ? (
                    results.comparisonRows.map((row) => (
                      <tr
                        key={row.size}
                        className={cn(
                          "border-t [border-top:var(--border-default)]",
                          row.isOversized
                            ? "text-[var(--color-text-muted)]"
                            : "text-[var(--color-text)]"
                        )}
                      >
                        <td
                          className={cn(
                            "px-3 py-3",
                            row.isRecommended
                              ? "border-l-4 border-[var(--color-brand)] font-semibold"
                              : ""
                          )}
                        >
                          {formatSize(row.size)} mm2
                        </td>
                        <td className="px-3 py-3">
                          {row.deratedAmpacity !== null ? `${row.deratedAmpacity} A` : "--"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3",
                            !row.voltageDropCompliant
                              ? "font-semibold text-red-600 dark:text-red-300"
                              : ""
                          )}
                        >
                          {row.voltageDropPct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-3">{row.powerLoss.toFixed(1)} W</td>
                        <td
                          className={cn(
                            "px-3 py-3 font-medium",
                            row.isCompliant
                              ? "text-[var(--color-brand)]"
                              : "text-red-600 dark:text-red-300"
                          )}
                        >
                          {row.complianceLabel}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t [border-top:var(--border-default)]">
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-[var(--color-text-muted)]"
                      >
                        Calculate a scenario to compare standard cable sizes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Voltage-drop utilization</SectionLabel>
            <div className="space-y-3">
              <div className="relative h-4 overflow-hidden rounded-full bg-[var(--color-overlay-subtle)]">
                {hasResults ? (
                  <div
                    className={cn(
                      "flex h-full items-center justify-end rounded-full pr-2 text-[10px] font-semibold text-white transition-all",
                      results.voltageDropPct < results.vdLimit * 0.8
                        ? "bg-[var(--color-brand)]"
                        : results.voltageDropPct <= results.vdLimit
                          ? "bg-[var(--badge-amber-text)]"
                          : "bg-red-500"
                    )}
                    style={{
                      width: `${Math.min((results.voltageDropPct / results.vdLimit) * 100, 100)}%`,
                    }}
                  >
                    {results.voltageDropPct.toFixed(2)}%
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>0%</span>
                <span>Limit {(hasResults ? results.vdLimit : maxVoltageDropPct).toFixed(1)}%</span>
              </div>
            </div>
          </PanelCard>

          <PanelCard className="space-y-3 bg-[var(--color-surface-secondary)]">
            <SectionLabel>Derating factors</SectionLabel>
            <p className="text-sm text-[var(--color-text)]">
              Temperature factor:{" "}
              <span className="font-semibold">
                {hasResults
                  ? results.tempFactor.toFixed(2)
                  : getTempCorrectionFactor(ambientTemp, insulationType).toFixed(2)}
              </span>{" "}
              (ambient {ambientTemp}C)
            </p>
            <p className="text-sm text-[var(--color-text)]">
              Grouping factor:{" "}
              <span className="font-semibold">
                {hasResults ? results.groupFactor.toFixed(2) : bundleFactor.toFixed(2)}
              </span>{" "}
              ({numCablesInBundle === 6 ? "6+" : numCablesInBundle} cables in bundle)
            </p>
            <p className="text-sm text-[var(--color-text)]">
              Combined derating:{" "}
              <span className="font-semibold">
                {hasResults
                  ? results.combinedDerating.toFixed(2)
                  : (getTempCorrectionFactor(ambientTemp, insulationType) * bundleFactor).toFixed(2)}
              </span>
              {hasResults && results.deratedAmpacity !== null ? (
                <>
                  {" "}
                  - Derated ampacity:{" "}
                  <span className="font-semibold">{results.deratedAmpacity} A</span>
                </>
              ) : null}
            </p>
          </PanelCard>

          {hasResults && results.aluminumSmallSizeWarning ? (
            <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
              Aluminum conductors below 16 mm2 are not recommended per IEC 60364-5-52.
            </div>
          ) : null}

          {hasResults && results.costHint ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--badge-amber-border)] bg-[var(--badge-amber-bg)] px-4 py-3 text-sm font-medium text-[var(--badge-amber-text)]">
              {results.costHint}
            </div>
          ) : null}

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {loadingAI ? (
              <LoadingIndicator message="AI is analyzing cable compliance..." />
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
                Calculate the system to generate compliance notes and installation guidance.
              </p>
            )}
          </PanelCard>

          <ExportButton
            toolName="Cable Sizing Calculator"
            data={pdfData}
            disabled={!hasResults || loadingAI || !pdfData}
          />
          {hasResults ? <ProjectReportCta /> : null}
        </div>
      </div>
    </section>
  );
}
