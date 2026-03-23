import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BoltIcon,
  CurrencyDollarIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import {
  ActionButton,
  Badge,
  ExportButton,
  MetricCard,
  PanelCard,
  ProjectReportCta,
  SectionLabel,
  SliderField,
} from "../ui";
import { callGemini } from "../../lib/gemini";
import {
  INVERTER_PRESETS,
  PANEL_PRESETS,
  calcLandUseCapacity,
  convertArea,
} from "../../lib/landUseCalc";
import {
  REPORT_STORAGE_KEYS,
  createToolReportSnapshot,
  saveToolReportResult,
} from "../../lib/reportStorage";

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]";

const NEXT_STEP_TOOLS = [
  {
    name: "Solar Yield Estimator",
    description: "Use the land capacity as the system size basis for yield estimation.",
    href: "/tools/solar",
    Icon: SunIcon,
  },
  {
    name: "Inverter Sizing",
    description: "Validate string layout and inverter fleet for the sized capacity.",
    href: "/tools/inverter-sizing",
    Icon: BoltIcon,
  },
  {
    name: "Solar ROI Calculator",
    description: "Turn the capacity figure into a financial case.",
    href: "/tools/roi",
    Icon: CurrencyDollarIcon,
  },
];

const AREA_UNIT_OPTIONS = [
  { value: "m2", label: "m²" },
  { value: "ha", label: "ha" },
  { value: "decare", label: "Decare" },
  { value: "acre", label: "Acre" },
  { value: "sqft", label: "ft²" },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatNumber(value, maximumFractionDigits = 0, minimumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

function formatArea(value, fractionDigits = 0) {
  return `${formatNumber(value, fractionDigits, fractionDigits)} m²`;
}

function formatCapacity(installedKwp) {
  if (!Number.isFinite(installedKwp)) {
    return "--";
  }

  if (installedKwp >= 1000) {
    return `${formatNumber(installedKwp / 1000, 2, 2)} MWp`;
  }

  return `${formatNumber(installedKwp, 1, 1)} kWp`;
}

function formatDensity(value) {
  return `${formatNumber(value, 0, 0)} kWp/ha`;
}

function getRatioStatus(dcAcRatio) {
  if (dcAcRatio > 1.35) {
    return {
      label: "High",
      tone: "amber",
      helper: "DC/AC ratio exceeds the preferred upper limit.",
    };
  }

  if (dcAcRatio < 0.9) {
    return {
      label: "Low",
      tone: "gray",
      helper: "AC fleet is conservatively sized relative to DC nameplate.",
    };
  }

  return {
    label: "Optimal",
    tone: "green",
    helper: "DC and AC sizing are in the preferred pre-design range.",
  };
}

function NeutralBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-[var(--color-text-muted)] [border:var(--border-default)]">
      {children}
    </span>
  );
}

function StatusBadge({ label, tone }) {
  if (tone === "green") {
    return <Badge color="green">{label}</Badge>;
  }

  if (tone === "amber") {
    return <Badge color="amber">{label}</Badge>;
  }

  return <NeutralBadge>{label}</NeutralBadge>;
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

function BreakdownBar({ label, value, percentage, fillClassName }) {
  const safeWidth = Math.max(0, Math.min(100, percentage));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="text-[var(--color-text-muted)]">
          {formatArea(value)} — {formatNumber(safeWidth, 1, 1)}%
        </span>
      </div>
      <svg viewBox="0 0 100 8" className="h-2 w-full">
        <rect
          x="0"
          y="0"
          width="100"
          height="8"
          rx="4"
          className="fill-gray-100 dark:fill-gray-800"
        />
        <rect x="0" y="0" width={safeWidth} height="8" rx="4" className={fillClassName} />
      </svg>
    </div>
  );
}

function LayoutDiagram({ results }) {
  const visiblePanelCount = results?.visiblePanelCount ?? 0;
  const displayCols = results?.displayCols ?? 0;
  const displayRows = results?.displayRows ?? 0;
  const actualCols = results?.actualCols ?? 0;
  const actualRows = results?.actualRows ?? 0;
  const totalPanels = results?.totalPanels ?? 0;

  if (!displayCols || !displayRows || !visiblePanelCount) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-dashed border-gray-200 bg-gray-50/50 p-5 text-sm leading-6 text-[var(--color-text-muted)] dark:border-gray-800 dark:bg-gray-900/40">
        The representative grid appears after a valid layout is calculated.
      </div>
    );
  }

  const cells = [];

  for (let row = 0; row < displayRows; row += 1) {
    for (let col = 0; col < displayCols; col += 1) {
      const index = row * displayCols + col;

      if (index >= visiblePanelCount) {
        continue;
      }

      cells.push(
        <rect
          key={`cell-${row}-${col}`}
          x={col + 0.08}
          y={row + 0.08}
          width="0.84"
          height="0.84"
          rx="0.12"
          className="fill-[var(--color-brand)]/85 stroke-white/10 dark:stroke-black/20"
          strokeWidth="0.04"
        />
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <svg
          viewBox={`0 0 ${displayCols} ${displayRows}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto w-full"
        >
          <rect
            x="0"
            y="0"
            width={displayCols}
            height={displayRows}
            rx="0.35"
            className="fill-white dark:fill-gray-950/50"
          />
          {cells}
        </svg>
      </div>
      {results.isDiagramTruncated ? (
        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          Indicative view — actual layout: {formatNumber(actualCols)} cols × {formatNumber(actualRows)} rows
        </p>
      ) : null}
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">
        {formatNumber(actualCols)} cols × {formatNumber(actualRows)} rows | Total:{" "}
        {formatNumber(totalPanels)} panels | GCR: {formatNumber(results.gcr, 2, 2)}
      </p>
    </div>
  );
}

function buildLandUsePrompt(summary) {
  return [
    "Respond in English in 3-4 sentences using a professional solar engineering tone.",
    "Cover capacity potential, land-use efficiency, inverter pre-sizing quality, and one next design step.",
    `Gross land area: ${summary.grossLandArea}. Usable area: ${summary.usableArea}. Unusable share: ${summary.unusableRatio}%.`,
    `Panel: ${summary.panelLabel}, ${summary.panelWatt} W, ${summary.panelWidth} m x ${summary.panelHeight} m.`,
    `Installed capacity: ${summary.installedCapacity}. Total panels: ${summary.totalPanels}. Power density: ${summary.powerDensity}.`,
    `Strings: ${summary.totalStrings}. Inverter model: ${summary.inverterLabel}. Inverters required: ${summary.invertersNeeded}. DC/AC ratio: ${summary.dcAcRatio}.`,
    `Area split: panel footprint ${summary.panelFootprint}, row spacing ${summary.rowSpacing}, unusable ${summary.unusableArea}.`,
  ].join(" ");
}

function buildPdfData(summary, aiAnalysis) {
  return {
    headerSubtitle: `${summary.panelLabel} | ${summary.grossLandArea}`,
    inputs: {
      "Gross land area": summary.grossLandArea,
      "Land area unit": summary.landAreaUnitLabel,
      "Usable area": summary.usableArea,
      "Unusable area": `${summary.unusableArea} (${summary.unusableRatio}%)`,
      "Panel type": summary.panelLabel,
      "Panel power": `${summary.panelWatt} W`,
      "Panel dimensions": `${summary.panelWidth} m × ${summary.panelHeight} m`,
      "Panels per string": String(summary.panelsPerString),
      "Inverter model": summary.inverterLabel,
      "Inverter power": `${summary.inverterKw} kW`,
    },
    metrics: [
      { label: "Installed Capacity", value: summary.installedMetricValue, unit: summary.installedMetricUnit },
      { label: "Total Panels", value: summary.totalPanels, unit: "panels" },
      { label: "Power Density", value: summary.powerDensityValue, unit: "kWp/ha" },
      { label: "Usable Area", value: summary.usableAreaValue, unit: "m²" },
    ],
    monthlyLabels: ["Panel footprint", "Row spacing", "Unusable"],
    monthlyData: [summary.panelFootprintValue, summary.rowSpacingValue, summary.unusableAreaValue],
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

export default function LandUseCapacityEstimator() {
  const [landAreaValue, setLandAreaValue] = useState("5");
  const [landAreaUnit, setLandAreaUnit] = useState("ha");
  const [unusableRatio, setUnusableRatio] = useState(15);
  const [panelPresetId, setPanelPresetId] = useState("standard_450");
  const [customPanelWatt, setCustomPanelWatt] = useState("450");
  const [customPanelWidth, setCustomPanelWidth] = useState("1.134");
  const [customPanelHeight, setCustomPanelHeight] = useState("2.094");
  const [panelsPerString, setPanelsPerString] = useState("20");
  const [inverterPresetId, setInverterPresetId] = useState("inv_250");
  const [results, setResults] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);

  const selectedPanelPreset = useMemo(
    () => PANEL_PRESETS.find((panel) => panel.id === panelPresetId) ?? PANEL_PRESETS[0],
    [panelPresetId]
  );
  const selectedInverterPreset = useMemo(
    () => INVERTER_PRESETS.find((inverter) => inverter.id === inverterPresetId) ?? INVERTER_PRESETS[2],
    [inverterPresetId]
  );

  const activePanel = useMemo(() => {
    if (panelPresetId === "custom") {
      return {
        id: "custom",
        label: "Custom",
        watt: toFiniteNumber(customPanelWatt),
        width: toFiniteNumber(customPanelWidth),
        height: toFiniteNumber(customPanelHeight),
      };
    }

    return selectedPanelPreset;
  }, [
    customPanelHeight,
    customPanelWatt,
    customPanelWidth,
    panelPresetId,
    selectedPanelPreset,
  ]);

  const normalizedLandAreaM2 = useMemo(() => {
    try {
      return convertArea(toFiniteNumber(landAreaValue), landAreaUnit, "m2");
    } catch {
      return 0;
    }
  }, [landAreaUnit, landAreaValue]);

  const m2Hint =
    landAreaUnit !== "m2" && normalizedLandAreaM2 > 0 ? `≈ ${formatArea(normalizedLandAreaM2)}` : "";
  const panelInfoArea =
    activePanel.width > 0 && activePanel.height > 0 ? activePanel.width * activePanel.height : 0;

  async function handleCalculate() {
    setError("");
    setAiAnalysis("");
    setIsCalculating(true);

    try {
      const nextResults = calcLandUseCapacity({
        landAreaValue,
        landAreaUnit,
        unusableRatio,
        panelWatt: activePanel.watt,
        panelWidth: activePanel.width,
        panelHeight: activePanel.height,
        panelsPerString,
        inverterKw: selectedInverterPreset.kw,
      });

      if (nextResults.landAreaM2 <= 0) {
        throw new Error("Enter a valid land area before calculating.");
      }

      if (activePanel.watt <= 0 || activePanel.width <= 0 || activePanel.height <= 0) {
        throw new Error("Panel power and dimensions must be valid positive values.");
      }

      if (toFiniteNumber(panelsPerString) < 10 || toFiniteNumber(panelsPerString) > 30) {
        throw new Error("Panels per string must stay within the 10 to 30 range.");
      }

      const ratioStatus = getRatioStatus(nextResults.dcAcRatio);
      const summary = {
        landAreaM2: nextResults.landAreaM2,
        landAreaUnit,
        landAreaUnitLabel:
          AREA_UNIT_OPTIONS.find((option) => option.value === landAreaUnit)?.label ?? landAreaUnit,
        grossLandArea: formatArea(nextResults.landAreaM2),
        usableArea: formatArea(nextResults.usableAreaM2),
        unusableArea: formatArea(nextResults.unusableAreaM2),
        unusableRatio,
        panelLabel: activePanel.label,
        panelWatt: formatNumber(activePanel.watt, 0, 0),
        panelWidth: formatNumber(activePanel.width, 3, 3),
        panelHeight: formatNumber(activePanel.height, 3, 3),
        panelArea: formatNumber(panelInfoArea, 2, 2),
        panelsPerString: formatNumber(toFiniteNumber(panelsPerString), 0, 0),
        inverterLabel: selectedInverterPreset.label,
        inverterKw: formatNumber(selectedInverterPreset.kw, 0, 0),
        totalPanels: formatNumber(nextResults.totalPanels, 0, 0),
        installedCapacity: formatCapacity(nextResults.installedKwp),
        installedMetricValue:
          nextResults.installedKwp >= 1000
            ? formatNumber(nextResults.installedMwp, 2, 2)
            : formatNumber(nextResults.installedKwp, 1, 1),
        installedMetricUnit: nextResults.installedKwp >= 1000 ? "MWp" : "kWp",
        installedKwp: nextResults.installedKwp,
        installedMwp: nextResults.installedMwp,
        powerDensity: formatDensity(nextResults.powerDensityKwpPerHa),
        powerDensityValue: formatNumber(nextResults.powerDensityKwpPerHa, 0, 0),
        totalStrings: formatNumber(nextResults.totalStrings, 0, 0),
        invertersNeeded: formatNumber(nextResults.invertersNeeded, 0, 0),
        dcAcRatio: formatNumber(nextResults.dcAcRatio, 2, 2),
        ratioStatus,
        panelFootprint: formatArea(nextResults.panelFootprintM2),
        panelFootprintValue: Number(nextResults.panelFootprintM2.toFixed(2)),
        rowSpacing: formatArea(nextResults.rowSpacingAreaM2),
        rowSpacingValue: Number(nextResults.rowSpacingAreaM2.toFixed(2)),
        unusableAreaValue: Number(nextResults.unusableAreaM2.toFixed(2)),
      };

      const composedResults = {
        ...nextResults,
        ratioStatus,
        panelLabel: activePanel.label,
        inverterLabel: selectedInverterPreset.label,
        panelWatt: activePanel.watt,
        panelWidth: activePanel.width,
        panelHeight: activePanel.height,
        panelsPerString: toFiniteNumber(panelsPerString),
        inverterKw: selectedInverterPreset.kw,
      };

      const nextPdfData = buildPdfData(summary, "");
      const snapshotInputs = {
        landAreaM2: Number(nextResults.landAreaM2.toFixed(2)),
        panelWatt: activePanel.watt,
        panelWidth: activePanel.width,
        panelHeight: activePanel.height,
        unusableRatio,
        panelsPerString: toFiniteNumber(panelsPerString),
        inverterKw: selectedInverterPreset.kw,
      };

      setResults(composedResults);
      setPdfData(nextPdfData);
      saveToolReportResult(
        REPORT_STORAGE_KEYS.landuse,
        createToolReportSnapshot({
          toolName: "Land Use & Capacity Estimator",
          inputs: snapshotInputs,
          results: composedResults,
          pdfData: nextPdfData,
          aiAnalysis: "",
        })
      );

      if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        try {
          const nextAiAnalysis = await callGemini(buildLandUsePrompt(summary));
          const finalPdfData = buildPdfData(summary, nextAiAnalysis);
          setAiAnalysis(nextAiAnalysis);
          setPdfData(finalPdfData);
          saveToolReportResult(
            REPORT_STORAGE_KEYS.landuse,
            createToolReportSnapshot({
              toolName: "Land Use & Capacity Estimator",
              inputs: snapshotInputs,
              results: composedResults,
              pdfData: finalPdfData,
              aiAnalysis: nextAiAnalysis,
            })
          );
        } catch {
          setAiAnalysis("");
        }
      }
    } catch (calculationError) {
      setError(calculationError.message || "Unable to calculate the land use layout.");
      setResults(null);
      setPdfData(null);
    } finally {
      setIsCalculating(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pb-24 sm:pt-4">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="teal">Phase 1</Badge>
          <Badge color="green">New tool</Badge>
          <Badge color="amber">Site layout</Badge>
          <Badge color="blue">Pure calculation + Gemini</Badge>
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-5xl">
          Land Use & Capacity Estimator
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
          Estimate installable PV capacity, panel count, land utilization, and inverter pre-sizing
          from the available site area.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <SectionLabel>Land area</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <NumberField
                label="Land area"
                value={landAreaValue}
                onChange={(event) => setLandAreaValue(event.target.value)}
                min="0"
                step="0.1"
                helper={m2Hint}
              />
              <SelectField
                label="Unit"
                value={landAreaUnit}
                onChange={(event) => setLandAreaUnit(event.target.value)}
                options={AREA_UNIT_OPTIONS}
              />
            </div>

            <SliderField
              label="Unusable area"
              min={5}
              max={40}
              step={1}
              value={unusableRatio}
              onChange={(event) => setUnusableRatio(Number(event.target.value))}
              displayValue={`${unusableRatio}%`}
            />
            <p className="-mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Roads, transformer station, setback margins, etc.
            </p>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Panel</SectionLabel>
            <SelectField
              label="Panel type"
              value={panelPresetId}
              onChange={(event) => setPanelPresetId(event.target.value)}
              options={PANEL_PRESETS.map((panel) => ({
                value: panel.id,
                label: panel.label,
              }))}
            />

            {panelPresetId === "custom" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="Watt"
                  value={customPanelWatt}
                  onChange={(event) => setCustomPanelWatt(event.target.value)}
                  min="1"
                  step="1"
                />
                <NumberField
                  label="Width (m)"
                  value={customPanelWidth}
                  onChange={(event) => setCustomPanelWidth(event.target.value)}
                  min="0.1"
                  step="0.001"
                />
                <NumberField
                  label="Height (m)"
                  value={customPanelHeight}
                  onChange={(event) => setCustomPanelHeight(event.target.value)}
                  min="0.1"
                  step="0.001"
                />
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-4 text-sm leading-6 text-[var(--color-text)] [border:var(--border-default)]">
                <p>
                  Power: {formatNumber(activePanel.watt, 0, 0)} W
                  <br />
                  Dimensions: {formatNumber(activePanel.width, 3, 3)} m ×{" "}
                  {formatNumber(activePanel.height, 3, 3)} m
                  <br />
                  Area: {formatNumber(panelInfoArea, 2, 2)} m²
                </p>
              </div>
            )}
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>System</SectionLabel>
            <NumberField
              label="Panels per string"
              value={panelsPerString}
              onChange={(event) => setPanelsPerString(event.target.value)}
              min="10"
              max="30"
              step="1"
              helper="panels / string"
            />
            <SelectField
              label="Inverter model"
              value={inverterPresetId}
              onChange={(event) => setInverterPresetId(event.target.value)}
              options={INVERTER_PRESETS.map((inverter) => ({
                value: inverter.id,
                label: inverter.label,
              }))}
              helper={`${formatNumber(selectedInverterPreset.kw, 0, 0)} kW AC nameplate`}
            />
          </PanelCard>

          <ActionButton onClick={handleCalculate} loading={isCalculating}>
            Calculate
          </ActionButton>
        </div>
        <div className="space-y-6">
          {!results ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-gray-200 px-6 py-10 text-center text-sm leading-7 text-[var(--color-text-muted)] dark:border-gray-700">
              Enter land area and panel type, then click Calculate.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard
                  label="Installed Capacity"
                  value={
                    results.installedKwp >= 1000
                      ? formatNumber(results.installedMwp, 2, 2)
                      : formatNumber(results.installedKwp, 1, 1)
                  }
                  unit={results.installedKwp >= 1000 ? "MWp" : "kWp"}
                  accent
                />
                <MetricCard
                  label="Total Panels"
                  value={formatNumber(results.totalPanels, 0, 0)}
                  unit=""
                />
                <MetricCard
                  label="Power Density"
                  value={formatNumber(results.powerDensityKwpPerHa, 0, 0)}
                  unit="kWp/ha"
                />
                <MetricCard
                  label="Usable Area"
                  value={formatNumber(results.usableAreaM2, 0, 0)}
                  unit="m2"
                />
              </div>

              <PanelCard className="space-y-4">
                <SectionLabel>String & inverter pre-sizing</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Total Strings
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                      {formatNumber(results.totalStrings, 0, 0)}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Inverters Required
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                      {formatNumber(results.invertersNeeded, 0, 0)}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          DC/AC Ratio
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                          {formatNumber(results.dcAcRatio, 2, 2)}
                        </p>
                      </div>
                      <StatusBadge
                        label={results.ratioStatus.label}
                        tone={results.ratioStatus.tone}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                      {results.ratioStatus.helper}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          Last String
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                          {results.totalPanels === 0
                            ? "--"
                            : results.lastStringPanels > 0
                              ? `${formatNumber(results.lastStringPanels, 0, 0)} panels`
                              : "Full string"}
                        </p>
                      </div>
                      {results.totalPanels > 0 ? (
                        results.lastStringPanels > 0 ? (
                          <Badge color="amber">Incomplete</Badge>
                        ) : (
                          <NeutralBadge>Full string</NeutralBadge>
                        )
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                      {results.lastStringPanels > 0
                        ? `${formatNumber(results.fullStrings, 0, 0)} complete strings plus one partial string.`
                        : "All strings close cleanly at the selected panel count."}
                    </p>
                  </div>
                </div>

                {results.dcAcRatio > 1.35 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                    DC/AC ratio exceeds 1.35 - consider adding inverter units or selecting a
                    higher-capacity model.
                  </div>
                ) : null}
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>Area breakdown</SectionLabel>
                <div className="space-y-4">
                  <BreakdownBar
                    label="Panel footprint"
                    value={results.panelFootprintM2}
                    percentage={results.panelFootprintPct}
                    fillClassName="fill-green-500"
                  />
                  <BreakdownBar
                    label="Row spacing"
                    value={results.rowSpacingAreaM2}
                    percentage={results.rowSpacingPct}
                    fillClassName="fill-blue-400"
                  />
                  <BreakdownBar
                    label="Unusable"
                    value={results.unusableAreaM2}
                    percentage={results.unusablePct}
                    fillClassName="fill-gray-300 dark:fill-gray-600"
                  />
                </div>
              </PanelCard>

              <PanelCard className="space-y-4">
                <SectionLabel>Representative layout diagram</SectionLabel>
                <LayoutDiagram results={results} />
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
                    description="Include land use and capacity in the final project report."
                  />
                </div>
              </PanelCard>
            </>
          )}

          <PanelCard className="space-y-4">
            <SectionLabel>AI analysis</SectionLabel>
            {!results ? (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                Calculate the layout to generate a capacity summary and site utilization notes.
              </p>
            ) : isCalculating ? (
              <LoadingIndicator message="AI is reviewing the layout and capacity summary..." />
            ) : aiAnalysis ? (
              <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                {aiAnalysis}
              </p>
            ) : (
              <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                AI analysis unavailable for this calculation.
              </p>
            )}
          </PanelCard>

          <div className="flex justify-end">
            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <ExportButton
                toolName="Land Use & Capacity Estimator"
                data={pdfData}
                disabled={!results || !pdfData || isCalculating}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
