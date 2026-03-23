import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  Badge,
  PanelCard,
  SectionLabel,
} from "@/components/ui";
import { callGemini } from "@/lib/gemini";
import { generateFullReport } from "@/lib/pdfExport";
import {
  REPORT_PHASES,
  REPORT_TOOL_DEFINITIONS,
  formatSavedResultTimestamp,
  loadToolReportResults,
} from "@/lib/reportStorage";

const INPUT_CLASS_NAME =
  "min-h-[48px] w-full rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none transition-shadow [border:var(--border-default)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-brand)]";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tr", label: "Turkish" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "TRY", label: "TRY" },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLanguageLabel(language) {
  return language === "tr" ? "Turkish" : "English";
}

function getMetricValue(snapshot, label) {
  return snapshot?.metrics?.find((metric) => metric.label === label)?.value ?? "--";
}

function pickSiteBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
SITE ASSESSMENT:
  Score: ${snapshot.results?.totalScore ?? "--"}/100 (${snapshot.results?.classification?.label ?? "--"})
  Solar irradiance: ${snapshot.results?.avgIrradiance ?? snapshot.results?.irradiance ?? "--"} kWh/m2/day
  Grid distance: ${snapshot.results?.gridDistanceKm ?? snapshot.inputs?.gridDistanceKm ?? "--"} km
`;
}

function pickLandUseBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
LAND USE & CAPACITY:
  Installed capacity: ${snapshot.results?.installedKwp ?? "--"} kWp
  Total panels: ${snapshot.results?.totalPanels ?? "--"}
  Power density: ${snapshot.results?.powerDensityKwpPerHa ?? "--"} kWp/ha
  Inverters required: ${snapshot.results?.invertersNeeded ?? "--"}
`;
}

function pickSolarBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
SOLAR YIELD ANALYSIS:
  System: ${snapshot.inputs?.kWp ?? "--"} kWp, ${snapshot.inputs?.systemType ?? "--"}
  Annual yield: ${snapshot.results?.annualYield ?? "--"} kWh/year
  Specific yield: ${snapshot.results?.specificYield ?? "--"} kWh/kWp
  Performance ratio: ${Math.round((snapshot.inputs?.PR ?? 0) * 100)}%
  CO2 avoided: ${snapshot.results?.co2Saved ?? "--"} kg/year
`;
}

function pickShadingBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
SHADING ANALYSIS:
  Annual shading loss: ${snapshot.results?.annualShadingLoss ?? "--"}%
  Lost energy: ${snapshot.results?.lostEnergy ?? "--"} kWh/year
`;
}

function pickPvLossBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
PV LOSS BREAKDOWN:
  Performance ratio: ${snapshot.results?.prPercent ?? "--"}%
  Net AC output: ${snapshot.results?.netAC ?? "--"} kWh/year
  Largest loss: ${snapshot.results?.largestLossStep?.name ?? snapshot.results?.largestLossName ?? "--"}
`;
}

function pickRoiBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
FINANCIAL ANALYSIS:
  System cost: ${snapshot.inputs?.systemCost ?? "--"}
  Payback period: ${snapshot.results?.paybackYear ?? "Not reached"} years
  25-year net gain: ${snapshot.results?.net25 ?? "--"}
  ROI: ${snapshot.results?.roi ?? "--"}%
`;
}

function pickLcoeBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  const cheapestName =
    snapshot.results?.cheapest?.name ??
    snapshot.results?.cheapestTech ??
    getMetricValue(snapshot, "Cheapest technology");
  const cheapestLcoe =
    snapshot.results?.cheapest?.lcoe ??
    snapshot.results?.cheapestLcoe ??
    getMetricValue(snapshot, "Cheapest LCOE");

  return `
LCOE ANALYSIS:
  Cheapest source: ${cheapestName}
  Cheapest LCOE: ${cheapestLcoe}/MWh
`;
}

function pickBatteryBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
STORAGE SYSTEM:
  Capacity: ${snapshot.results?.nominalCapacity ?? "--"} kWh
  Technology: ${snapshot.inputs?.battType ?? snapshot.inputs?.batteryType ?? "--"}
`;
}

function pickWindBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
WIND ENERGY:
  Annual production: ${snapshot.results?.annualMWh ?? "--"} MWh/year
  Capacity factor: ${snapshot.results?.capacityFactor ?? "--"}%
  Average wind speed: ${snapshot.results?.avgScaledWind ?? "--"} m/s
`;
}

function pickInverterBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
INVERTER SIZING:
  Verdict: ${snapshot.results?.verdict?.label ?? "--"}
  DC/AC ratio: ${snapshot.results?.dcAcRatio ?? "--"}
  Clipping estimate: ${snapshot.results?.clippingLossPct ?? "--"}%
  Inverter count: ${snapshot.results?.numInverters ?? "--"}
`;
}

function pickCableBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
CABLE SIZING:
  Recommended size: ${snapshot.results?.recommendedSize ?? "--"} mm2
  Voltage drop: ${snapshot.results?.selected?.voltageDropPct ?? "--"}%
  Annual cable loss: ${snapshot.results?.selected?.annualEnergyLoss ?? "--"} kWh/year
`;
}

function pickStorageRoiBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
STORAGE ROI:
  NPV: ${snapshot.results?.npv ?? "--"}
  Payback: ${snapshot.results?.paybackYear ?? "Not reached"} years
  LCOS: ${snapshot.results?.lcos ?? "--"} $/kWh
`;
}

function pickCarbonBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
CARBON INTENSITY:
  Country: ${snapshot.results?.country ?? "--"}
  Grid intensity: ${snapshot.results?.intensity ?? "--"} gCO2/kWh
  Renewable share: ${snapshot.results?.renewablePct ?? "--"}%
`;
}

function pickScope2Block(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
ESG / SCOPE 2:
  Market-based: ${snapshot.results?.marketBased ?? "--"} tCO2e/year
  RE coverage: ${snapshot.results?.reCoverage ?? "--"}%
`;
}

function pickHydrogenBlock(snapshot) {
  if (!snapshot) {
    return "";
  }

  return `
GREEN HYDROGEN:
  LCOH: ${snapshot.results?.lcoh ?? "--"} $/kg
  Annual production: ${snapshot.results?.annualTonnes ?? "--"} t/year
  Carbon intensity: ${snapshot.results?.carbonIntensity ?? "--"} kgCO2/kgH2
`;
}

function buildExecutiveSummaryPrompt(projectData, results, language) {
  const langLabel = getLanguageLabel(language);

  return `You are a senior renewable energy consultant writing an executive summary for a solar project feasibility report.

Project: ${projectData.projectName}
Location: ${projectData.projectLocation}
Client: ${projectData.clientName || "Not specified"}
Date: ${projectData.reportDate}

Available analysis results:
${pickSiteBlock(results.site)}
${pickLandUseBlock(results.landuse)}
${pickSolarBlock(results.solar)}
${pickWindBlock(results.wind)}
${pickCarbonBlock(results.carbon)}
${pickShadingBlock(results.shading)}
${pickPvLossBlock(results.pvloss)}
${pickInverterBlock(results.inverter)}
${pickCableBlock(results.cable)}
${pickStorageRoiBlock(results.storageRoi)}
${pickRoiBlock(results.roi)}
${pickLcoeBlock(results.lcoe)}
${pickBatteryBlock(results.battery)}
${pickScope2Block(results.scope2)}
${pickHydrogenBlock(results.h2)}

Write a professional executive summary in ${langLabel} with:
1. Project overview paragraph (location, size, technology)
2. Key findings paragraph (yield, PR, main losses)
3. Financial viability paragraph (payback, ROI, LCOE)
4. Environmental impact paragraph (CO2, ESG)
5. Recommendation paragraph (go/no-go, key risks, next steps)

Use formal engineering report language.
Total length: 350-450 words.
Do NOT use bullet points - write in flowing paragraphs.`;
}

function ToolAvailabilityRow({
  tool,
  snapshot,
  selected,
  onToggle,
  reportLanguage,
}) {
  const isAvailable = Boolean(snapshot);
  const locale = reportLanguage === "tr" ? "tr-TR" : "en-US";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-md)] p-4 [border:var(--border-default)] md:flex-row md:items-center md:justify-between",
        isAvailable ? "bg-[var(--color-brand-light)]" : "bg-[var(--color-surface-secondary)]"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              isAvailable
                ? "bg-[var(--color-brand)] text-white"
                : "bg-[var(--color-overlay-subtle)] text-[var(--color-text-muted)]"
            )}
          >
            {isAvailable ? "OK" : "--"}
          </span>
          <p className="text-sm font-semibold text-[var(--color-text)]">{tool.name}</p>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {isAvailable
            ? `Last calculated: ${formatSavedResultTimestamp(snapshot.timestamp, locale)}`
            : "Not calculated yet"}
        </p>
      </div>

      {isAvailable ? (
        <label className="inline-flex items-center gap-3 text-sm font-medium text-[var(--color-text)]">
          <span>Include</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggle(tool.id, event.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
        </label>
      ) : (
        <Link
          href={tool.href}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 [border:var(--border-default)] [border-color:var(--color-brand)] hover:bg-[var(--color-brand-light)]"
        >
          Open tool
        </Link>
      )}
    </div>
  );
}

export default function ReportGenerator() {
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reportDate, setReportDate] = useState(todayIsoDate);
  const [availableResults, setAvailableResults] = useState({});
  const [selectedSections, setSelectedSections] = useState({});
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState(true);
  const [includeMethodologyNotes, setIncludeMethodologyNotes] = useState(true);
  const [includeInputAppendix, setIncludeInputAppendix] = useState(true);
  const [reportLanguage, setReportLanguage] = useState("en");
  const [currency, setCurrency] = useState("USD");
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadedResults = loadToolReportResults();
    setAvailableResults(loadedResults);
    setSelectedSections(
      REPORT_TOOL_DEFINITIONS.reduce((accumulator, tool) => {
        accumulator[tool.id] = Boolean(loadedResults[tool.id]);
        return accumulator;
      }, {})
    );
  }, []);

  const selectedResults = useMemo(
    () =>
      REPORT_TOOL_DEFINITIONS.reduce((accumulator, tool) => {
        if (selectedSections[tool.id] && availableResults[tool.id]) {
          accumulator[tool.id] = availableResults[tool.id];
        }
        return accumulator;
      }, {}),
    [availableResults, selectedSections]
  );

  const selectedCount = Object.keys(selectedResults).length;

  function markSummaryDirty() {
    setExecutiveSummary("");
    setError("");
  }

  function handleToggleSection(toolId, checked) {
    markSummaryDirty();
    setSelectedSections((current) => ({ ...current, [toolId]: checked }));
  }

  function validateProjectDetails() {
    if (!projectName.trim() || !projectLocation.trim()) {
      setError("Project name and project location are required.");
      return false;
    }

    if (!selectedCount) {
      setError("Select at least one available tool result to generate a report.");
      return false;
    }

    return true;
  }

  async function generateSummary(force = false) {
    if (!validateProjectDetails()) {
      return null;
    }

    if (executiveSummary && !force) {
      return executiveSummary;
    }

    setGeneratingAI(true);
    setError("");

    try {
      const summary = await callGemini(
        buildExecutiveSummaryPrompt(
          {
            projectName,
            projectLocation,
            clientName,
            preparedBy,
            reportDate,
          },
          selectedResults,
          reportLanguage
        )
      );

      setExecutiveSummary(summary);
      return summary;
    } catch (summaryError) {
      setError(summaryError.message || "Executive summary generation failed.");
      return null;
    } finally {
      setGeneratingAI(false);
    }
  }

  async function handleGenerateReport() {
    if (!validateProjectDetails()) {
      return;
    }

    setGeneratingReport(true);
    setError("");

    let summaryText = executiveSummary;

    try {
      if (includeExecutiveSummary && !summaryText) {
        summaryText = await generateSummary();

        if (!summaryText) {
          setGeneratingReport(false);
          return;
        }
      }

      await generateFullReport(
        {
          projectName,
          projectLocation,
          clientName,
          preparedBy,
          reportDate,
        },
        selectedResults,
        includeExecutiveSummary ? summaryText : "",
        {
          language: reportLanguage,
          currency,
          includeExecutiveSummary,
          includeMethodologyNotes,
          includeInputAppendix,
        }
      );
    } catch (reportError) {
      setError(reportError.message || "Report generation failed.");
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="green">Flagship feature</Badge>
          <Badge color="teal">Project-wide reporting</Badge>
          <Badge color="amber">Gemini executive summary</Badge>
        </div>
        <h1 className="text-[30px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Solar Project Report Generator
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
          Combine all tool results into a single professional PDF report.
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-6">
          <PanelCard className="space-y-5">
            <SectionLabel>Project details</SectionLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <SectionLabel>Project name</SectionLabel>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => {
                    markSummaryDirty();
                    setProjectName(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                  placeholder="Utility-scale PV in Bursa"
                />
              </label>
              <label className="flex flex-col gap-2">
                <SectionLabel>Project location</SectionLabel>
                <input
                  type="text"
                  value={projectLocation}
                  onChange={(event) => {
                    markSummaryDirty();
                    setProjectLocation(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                  placeholder="Bursa, Turkey"
                />
              </label>
              <label className="flex flex-col gap-2">
                <SectionLabel>Client / company name</SectionLabel>
                <input
                  type="text"
                  value={clientName}
                  onChange={(event) => {
                    markSummaryDirty();
                    setClientName(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                  placeholder="Optional"
                />
              </label>
              <label className="flex flex-col gap-2">
                <SectionLabel>Prepared by</SectionLabel>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(event) => {
                    markSummaryDirty();
                    setPreparedBy(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                  placeholder="Optional"
                />
              </label>
              <label className="flex flex-col gap-2 md:max-w-[240px]">
                <SectionLabel>Report date</SectionLabel>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(event) => {
                    markSummaryDirty();
                    setReportDate(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                />
              </label>
            </div>
          </PanelCard>

          <PanelCard className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Available tool results</SectionLabel>
              <span className="text-sm font-medium text-[var(--color-text-muted)]">
                {selectedCount} selected
              </span>
            </div>

            <div className="space-y-5">
              {REPORT_PHASES.map((phase) => (
                <div key={phase.id} className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{phase.label}</p>
                  <div className="space-y-3">
                    {REPORT_TOOL_DEFINITIONS.filter((tool) => tool.phase === phase.id).map((tool) => (
                      <ToolAvailabilityRow
                        key={tool.id}
                        tool={tool}
                        snapshot={availableResults[tool.id]}
                        selected={Boolean(selectedSections[tool.id])}
                        onToggle={handleToggleSection}
                        reportLanguage={reportLanguage}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard className="space-y-5">
            <SectionLabel>Report options</SectionLabel>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  Include executive summary
                </span>
                <input
                  type="checkbox"
                  checked={includeExecutiveSummary}
                  onChange={(event) => {
                    markSummaryDirty();
                    setIncludeExecutiveSummary(event.target.checked);
                  }}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  Include methodology notes
                </span>
                <input
                  type="checkbox"
                  checked={includeMethodologyNotes}
                  onChange={(event) => setIncludeMethodologyNotes(event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)]">
                <span className="text-sm font-medium text-[var(--color-text)]">
                  Include input parameters appendix
                </span>
                <input
                  type="checkbox"
                  checked={includeInputAppendix}
                  onChange={(event) => setIncludeInputAppendix(event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>

              <label className="flex flex-col gap-2">
                <SectionLabel>Report language</SectionLabel>
                <select
                  value={reportLanguage}
                  onChange={(event) => {
                    markSummaryDirty();
                    setReportLanguage(event.target.value);
                  }}
                  className={INPUT_CLASS_NAME}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 md:max-w-[240px]">
                <SectionLabel>Currency</SectionLabel>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={INPUT_CLASS_NAME}
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                  Display format only. No FX conversion is applied.
                </p>
              </label>
            </div>
          </PanelCard>
        </div>

        <div className="space-y-6">
          <PanelCard className="space-y-4">
            <SectionLabel>Executive summary</SectionLabel>
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">
              Generate a project-wide narrative from the currently selected tool results. The
              summary is used as the executive overview page in the final PDF.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionButton onClick={() => generateSummary(true)} loading={generatingAI} variant="secondary">
                {executiveSummary ? "Regenerate executive summary" : "Generate executive summary"}
              </ActionButton>
              <ActionButton onClick={handleGenerateReport} loading={generatingReport} variant="primary">
                Generate full PDF report
              </ActionButton>
            </div>

            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-secondary)] p-5 [border:var(--border-default)]">
              {executiveSummary ? (
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-text)]">
                  {executiveSummary}
                </p>
              ) : (
                <p className="text-sm leading-7 text-[var(--color-text-muted)]">
                  No summary generated yet. Generate the executive summary to preview the report
                  narrative before exporting the final PDF.
                </p>
              )}
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Report output</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Included sections
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                  {selectedCount}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 [border:var(--border-default)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Saved tool outputs
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                  {Object.keys(availableResults).length}
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">
              The generator never reruns engineering calculations. It only reads the latest
              normalized snapshots saved by each Voltiq tool in your browser.
            </p>
          </PanelCard>

          <PanelCard className="space-y-4">
            <SectionLabel>Included report sections</SectionLabel>
            <div className="space-y-2">
              {REPORT_TOOL_DEFINITIONS.filter((tool) => selectedSections[tool.id] && availableResults[tool.id]).map(
                (tool) => (
                  <div
                    key={tool.id}
                    className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] px-4 py-3 [border:var(--border-default)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium text-[var(--color-text)]">{tool.name}</span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand)]">
                      Included
                    </span>
                  </div>
                )
              )}
            </div>
          </PanelCard>
        </div>
      </div>
    </section>
  );
}
