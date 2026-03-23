import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  ArrowRight,
  Battery,
  ChevronDown,
  Cpu,
  Plus,
  Sun,
  TrendingUp,
  Workflow,
  X,
} from "lucide-react";
import { ActionButton, PanelCard } from "@/components/ui";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { callGemini } from "@/lib/gemini";
import { generateFullReport } from "@/lib/pdfExport";
import {
  REPORT_PHASES,
  REPORT_TOOL_DEFINITIONS,
  loadToolReportResults,
} from "@/lib/reportStorage";

const NODE_WIDTH = 210;
const NODE_HEIGHT = 120;
const INITIAL_CONTENT_SIZE = { width: 800, height: 500 };

const INPUT_CLASS_NAME =
  "w-full rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-shadow [border:var(--border-default)] focus:ring-2 focus:ring-[var(--color-brand)]";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tr", label: "Turkish" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "TRY", label: "TRY" },
] as const;

type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];
type CurrencyValue = (typeof CURRENCY_OPTIONS)[number]["value"];

type MetricItem = {
  label: string;
  value: string | number;
  unit?: string;
};

type ReportSnapshot = {
  timestamp?: string;
  toolName?: string;
  inputs?: Record<string, any>;
  results?: Record<string, any>;
  metrics?: MetricItem[];
  chart?: { labels?: string[]; values?: number[] } | null;
  aiAnalysis?: string;
  headerSubtitle?: string;
};

type Snapshots = Record<string, ReportSnapshot>;

type CanvasNode = {
  id: string;
  toolId: string;
};

type NodePosition = {
  x: number;
  y: number;
};

type ProjectDetails = {
  name: string;
  location: string;
  client: string;
  preparedBy: string;
  date: string;
};

type ReportOptions = {
  includeExecutiveSummary: boolean;
  includeMethodologyNotes: boolean;
  includeInputAppendix: boolean;
  language: LanguageValue;
  currency: CurrencyValue;
};

type PhaseMeta = {
  icon: typeof Sun;
  iconText: string;
  dot: string;
  badge: string;
  nodeAccent: string;
  button: string;
  buttonDisabled: string;
};

const phaseMetaMap: Record<string, PhaseMeta> = {
  phase1: {
    icon: Sun,
    iconText: "text-emerald-400",
    dot: "bg-emerald-400",
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
    nodeAccent: "ring-1 ring-inset ring-emerald-400/20",
    button: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
    buttonDisabled: "border-emerald-400/20 bg-emerald-400/5 text-emerald-400/30",
  },
  phase2: {
    icon: Cpu,
    iconText: "text-blue-400",
    dot: "bg-blue-400",
    badge: "border-blue-400/40 bg-blue-400/10 text-blue-400",
    nodeAccent: "ring-1 ring-inset ring-blue-400/20",
    button: "border-blue-400/40 bg-blue-400/10 text-blue-400",
    buttonDisabled: "border-blue-400/20 bg-blue-400/5 text-blue-400/30",
  },
  phase3: {
    icon: Battery,
    iconText: "text-amber-400",
    dot: "bg-amber-400",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    nodeAccent: "ring-1 ring-inset ring-amber-400/20",
    button: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    buttonDisabled: "border-amber-400/20 bg-amber-400/5 text-amber-400/30",
  },
  phase4: {
    icon: TrendingUp,
    iconText: "text-purple-400",
    dot: "bg-purple-400",
    badge: "border-purple-400/40 bg-purple-400/10 text-purple-400",
    nodeAccent: "ring-1 ring-inset ring-purple-400/20",
    button: "border-purple-400/40 bg-purple-400/10 text-purple-400",
    buttonDisabled: "border-purple-400/20 bg-purple-400/5 text-purple-400/30",
  },
};

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function getLanguageLabel(language: LanguageValue) {
  return language === "tr" ? "Turkish" : "English";
}

function getMetricValue(snapshot: ReportSnapshot | undefined, label: string) {
  return snapshot?.metrics?.find((metric) => metric.label === label)?.value ?? "--";
}

function valueToText(value: unknown, fractionDigits = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "--";
}

function pickSiteBlock(snapshot?: ReportSnapshot) {
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

function pickLandUseBlock(snapshot?: ReportSnapshot) {
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

function pickSolarBlock(snapshot?: ReportSnapshot) {
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

function pickShadingBlock(snapshot?: ReportSnapshot) {
  if (!snapshot) {
    return "";
  }

  return `
SHADING ANALYSIS:
  Annual shading loss: ${snapshot.results?.annualShadingLoss ?? "--"}%
  Lost energy: ${snapshot.results?.lostEnergy ?? "--"} kWh/year
`;
}

function pickPvLossBlock(snapshot?: ReportSnapshot) {
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

function pickRoiBlock(snapshot?: ReportSnapshot) {
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

function pickLcoeBlock(snapshot?: ReportSnapshot) {
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

function pickBatteryBlock(snapshot?: ReportSnapshot) {
  if (!snapshot) {
    return "";
  }

  return `
STORAGE SYSTEM:
  Capacity: ${snapshot.results?.nominalCapacity ?? "--"} kWh
  Technology: ${snapshot.inputs?.battType ?? snapshot.inputs?.batteryType ?? "--"}
`;
}

function pickWindBlock(snapshot?: ReportSnapshot) {
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

function pickInverterBlock(snapshot?: ReportSnapshot) {
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

function pickCableBlock(snapshot?: ReportSnapshot) {
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

function pickStorageRoiBlock(snapshot?: ReportSnapshot) {
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

function pickCarbonBlock(snapshot?: ReportSnapshot) {
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

function pickScope2Block(snapshot?: ReportSnapshot) {
  if (!snapshot) {
    return "";
  }

  return `
ESG / SCOPE 2:
  Market-based: ${snapshot.results?.marketBased ?? "--"} tCO2e/year
  RE coverage: ${snapshot.results?.reCoverage ?? "--"}%
`;
}

function pickHydrogenBlock(snapshot?: ReportSnapshot) {
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

function buildExecutiveSummaryPrompt(
  projectData: ProjectDetails,
  results: Snapshots,
  language: LanguageValue
) {
  const langLabel = getLanguageLabel(language);

  return `You are a senior renewable energy consultant writing an executive summary for a solar project feasibility report.

Project: ${projectData.name}
Location: ${projectData.location}
Client: ${projectData.client || "Not specified"}
Date: ${projectData.date}

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

function extractStatusLine(toolId: string, snapshot?: ReportSnapshot): string {
  if (!snapshot || typeof snapshot !== "object") {
    return "Not calculated yet";
  }

  switch (toolId) {
    case "site":
      return snapshot.results?.totalScore
        ? `${Number(snapshot.results.totalScore).toLocaleString()} / 100 score`
        : "Calculated";
    case "solar":
      return snapshot.results?.annualYield
        ? `${Number(snapshot.results.annualYield).toLocaleString()} kWh/year`
        : "Calculated";
    case "wind":
      return snapshot.results?.annualMWh
        ? `${Number(snapshot.results.annualMWh).toLocaleString()} MWh/year`
        : "Calculated";
    case "landuse":
      return snapshot.results?.installedKwp
        ? `${Number(snapshot.results.installedKwp).toLocaleString()} kWp`
        : "Calculated";
    case "pvloss":
      return snapshot.results?.prPercent ? `PR ${snapshot.results.prPercent}%` : "Calculated";
    case "inverter":
      return snapshot.results?.dcAcRatio
        ? `${Number(snapshot.results.dcAcRatio).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} DC/AC`
        : "Calculated";
    case "cable":
      return snapshot.results?.recommendedSize
        ? `${Number(snapshot.results.recommendedSize).toLocaleString()} mm2`
        : "Calculated";
    case "battery":
      return snapshot.results?.nominalCapacity
        ? `${Number(snapshot.results.nominalCapacity).toLocaleString()} kWh`
        : "Calculated";
    case "storageRoi":
      return snapshot.results?.paybackYear
        ? `Payback ${snapshot.results.paybackYear} yr`
        : "Calculated";
    case "roi":
      return snapshot.results?.paybackYear
        ? `Payback ${snapshot.results.paybackYear} yr`
        : "Calculated";
    case "lcoe":
      return snapshot.results?.cheapest?.lcoe || snapshot.results?.cheapestLcoe
        ? `LCOE ${valueToText(snapshot.results?.cheapest?.lcoe ?? snapshot.results?.cheapestLcoe)} $/MWh`
        : "Calculated";
    case "scope2":
      return snapshot.results?.marketBased
        ? `${Number(snapshot.results.marketBased).toLocaleString()} tCO2e`
        : "Calculated";
    case "h2":
      return snapshot.results?.lcoh
        ? `LCOH ${valueToText(snapshot.results.lcoh, 2)} $/kg`
        : "Calculated";
    default:
      return "Calculated";
  }
}

function getPhaseMeta(phaseId: string) {
  return phaseMetaMap[phaseId] ?? phaseMetaMap.phase1;
}

function buildInitialNodePosition(nodeCount: number) {
  const col = nodeCount % 3;
  const row = Math.floor(nodeCount / 3);

  return {
    x: 30 + col * 280,
    y: 30 + row * 150,
  };
}

type WorkflowNodeProps = {
  node: CanvasNode;
  tool: { id: string; name: string; href: string; phase: string };
  position: NodePosition;
  isCalculated: boolean;
  isSelected: boolean;
  statusLine: string;
  onRemove: (id: string) => void;
  onToggle: (toolId: string, checked: boolean) => void;
  onDragStart: (id: string) => void;
  onDrag: (id: string, info: PanInfo) => void;
  onDragEnd: () => void;
};

function WorkflowNode({
  node,
  tool,
  position,
  isCalculated,
  isSelected,
  statusLine,
  onRemove,
  onToggle,
  onDragStart,
  onDrag,
  onDragEnd,
}: WorkflowNodeProps) {
  const phaseMeta = getPhaseMeta(tool.phase);
  const PhaseIcon = phaseMeta.icon;
  const phaseNumber = tool.phase.replace("phase", "");

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={{ left: 0, top: 0, right: 100000, bottom: 100000 }}
      onDragStart={() => onDragStart(node.id)}
      onDrag={(_, info) => onDrag(node.id, info)}
      onDragEnd={onDragEnd}
      style={{ x: position.x, y: position.y, width: NODE_WIDTH, transformOrigin: "0 0" }}
      className="absolute cursor-grab"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
    >
      <Card
        className={`relative overflow-hidden rounded-xl bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] p-3 backdrop-blur ${phaseMeta.nodeAccent}`}
        style={{ height: NODE_HEIGHT }}
      >
        <button
          type="button"
          onClick={() => onRemove(node.id)}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] transition-all [border:var(--border-default)] hover:text-red-400"
          aria-label={`Remove ${tool.name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
        <div className="absolute left-2 top-2 z-10" onPointerDown={(event) => event.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onChange={(event) => onToggle(tool.id, event.target.checked)}
            className="h-3.5 w-3.5"
            aria-label={`Include ${tool.name}`}
          />
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-secondary)] ${phaseMeta.nodeAccent}`}
            >
              <PhaseIcon className={`h-3 w-3 ${phaseMeta.iconText}`} />
            </div>
            <div className="min-w-0">
              <ShadBadge
                variant="outline"
                className="mb-0.5 rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0 text-[9px] text-[var(--color-text-muted)] [border:var(--border-default)]"
              >
                Phase {phaseNumber}
              </ShadBadge>
              <h3 className="truncate text-xs font-semibold text-[var(--color-text)]">
                {tool.name}
              </h3>
            </div>
          </div>

          <p className="truncate pl-0.5 text-[10px] text-[var(--color-text-muted)]">{statusLine}</p>

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <ArrowRight className="h-2.5 w-2.5" />
              <span className={isCalculated ? "text-emerald-400" : "text-[var(--color-text-muted)]"}>
                {isCalculated ? "Ready" : "Pending"}
              </span>
            </div>

            <Link
              href={tool.href}
              onPointerDown={(event) => event.stopPropagation()}
              className="text-[10px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Open →
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function ReportGenerator() {
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [contentSize, setContentSize] = useState(INITIAL_CONTENT_SIZE);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    name: "",
    location: "",
    client: "",
    preparedBy: "",
    date: todayIsoDate(),
  });
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    includeExecutiveSummary: true,
    includeMethodologyNotes: true,
    includeInputAppendix: true,
    language: "en",
    currency: "USD",
  });
  const [snapshots, setSnapshots] = useState<Snapshots>({});
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<Record<string, NodePosition>>({});

  useEffect(() => {
    const results = loadToolReportResults() as Snapshots;
    setSnapshots(results);
  }, []);

  const selectedResults = useMemo(
    () =>
      (REPORT_TOOL_DEFINITIONS as Array<{ id: string }>).reduce((accumulator, definition) => {
        if (selectedSections.has(definition.id) && snapshots[definition.id]) {
          accumulator[definition.id] = snapshots[definition.id];
        }
        return accumulator;
      }, {} as Snapshots),
    [selectedSections, snapshots]
  );

  const connections = useMemo(
    () =>
      canvasNodes.slice(0, -1).map((node, index) => ({
        from: node.id,
        to: canvasNodes[index + 1].id,
      })),
    [canvasNodes]
  );

  const calculatedOnCanvas = useMemo(
    () => canvasNodes.filter((node) => Boolean(snapshots[node.toolId])).length,
    [canvasNodes, snapshots]
  );

  const selectedOnCanvas = selectedSections.size;

  const filteredPhases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (REPORT_PHASES as Array<{ id: string; label: string }>).map((phase) => ({
      ...phase,
      tools: (REPORT_TOOL_DEFINITIONS as Array<{
        id: string;
        name: string;
        href: string;
        phase: string;
      }>).filter((tool) => {
        if (tool.phase !== phase.id) {
          return false;
        }

        if (!query) {
          return true;
        }

        return tool.name.toLowerCase().includes(query);
      }),
    }));
  }, [search]);

  function markSummaryDirty() {
    setExecutiveSummary("");
    setError("");
  }

  function updateProjectDetails<K extends keyof ProjectDetails>(key: K, value: ProjectDetails[K]) {
    markSummaryDirty();
    setProjectDetails((current) => ({ ...current, [key]: value }));
  }

  function updateReportOptions<K extends keyof ReportOptions>(key: K, value: ReportOptions[K]) {
    markSummaryDirty();
    setReportOptions((current) => ({ ...current, [key]: value }));
  }

  function togglePhase(phaseId: string) {
    setCollapsedPhases((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  function addNode(toolId: string) {
    if (canvasNodes.some((node) => node.toolId === toolId)) {
      return;
    }

    markSummaryDirty();
    const id = Date.now().toString();
    const pos = buildInitialNodePosition(canvasNodes.length);

    setCanvasNodes((current) => [...current, { id, toolId }]);
    setPositions((current) => ({ ...current, [id]: pos }));
    setSelectedSections((current) => new Set([...current, toolId]));
    setContentSize((current) => ({
      width: Math.max(current.width, pos.x + NODE_WIDTH + 50),
      height: Math.max(current.height, pos.y + NODE_HEIGHT + 50),
    }));
  }

  function removeNode(id: string) {
    const node = canvasNodes.find((item) => item.id === id);

    markSummaryDirty();
    setCanvasNodes((current) => current.filter((item) => item.id !== id));
    setPositions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    if (node) {
      setSelectedSections((current) => {
        const next = new Set(current);
        next.delete(node.toolId);
        return next;
      });
    }
  }

  function clearCanvas() {
    markSummaryDirty();
    setCanvasNodes([]);
    setPositions({});
    setSelectedSections(new Set());
    setContentSize(INITIAL_CONTENT_SIZE);
  }

  function toggleSection(toolId: string, checked: boolean) {
    markSummaryDirty();
    setSelectedSections((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(toolId);
      } else {
        next.delete(toolId);
      }
      return next;
    });
  }

  function handleDragStart(id: string) {
    dragStart.current[id] = positions[id];
  }

  function handleDrag(id: string, info: PanInfo) {
    const start = dragStart.current[id];

    if (!start) {
      return;
    }

    const x = Math.max(0, start.x + info.offset.x);
    const y = Math.max(0, start.y + info.offset.y);

    flushSync(() => {
      setPositions((current) => ({ ...current, [id]: { x, y } }));
    });

    setContentSize((current) => ({
      width: Math.max(current.width, x + NODE_WIDTH + 50),
      height: Math.max(current.height, y + NODE_HEIGHT + 50),
    }));
  }

  function handleDragEnd() {
    dragStart.current = {};
  }

  function validateProjectDetails() {
    if (!projectDetails.name.trim() || !projectDetails.location.trim()) {
      setError("Project name and project location are required.");
      return false;
    }

    if (!Object.keys(selectedResults).length) {
      setError("Add at least one calculated tool to the canvas to generate a report.");
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
        buildExecutiveSummaryPrompt(projectDetails, selectedResults, reportOptions.language)
      );
      setExecutiveSummary(summary);
      return summary;
    } catch {
      setError("Failed to generate executive summary. Check your Gemini API key.");
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
      if (reportOptions.includeExecutiveSummary && !summaryText) {
        summaryText = (await generateSummary(true)) || "";

        if (!summaryText) {
          setGeneratingReport(false);
          return;
        }
      }

      await generateFullReport(
        {
          projectName: projectDetails.name,
          projectLocation: projectDetails.location,
          clientName: projectDetails.client,
          preparedBy: projectDetails.preparedBy,
          reportDate: projectDetails.date,
        },
        selectedResults,
        reportOptions.includeExecutiveSummary ? summaryText : "",
        {
          language: reportOptions.language,
          currency: reportOptions.currency,
          includeExecutiveSummary: reportOptions.includeExecutiveSummary,
          includeMethodologyNotes: reportOptions.includeMethodologyNotes,
          includeInputAppendix: reportOptions.includeInputAppendix,
        }
      );
    } catch {
      setError("Failed to generate PDF report.");
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <section>
      <div className="flex h-[calc(100vh-220px)] min-h-[600px] flex-col gap-4 lg:flex-row">
        <aside className="order-2 flex w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] backdrop-blur [border:var(--border-default)] lg:order-1 lg:w-64">
          <div className="border-b px-4 py-3 [border-color:rgba(255,255,255,0.08)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Add Tools
              </span>
              <ShadBadge variant="outline" className="rounded-full text-[10px]">
                {canvasNodes.length} / {REPORT_TOOL_DEFINITIONS.length}
              </ShadBadge>
            </div>
            <input
              type="text"
              placeholder="Search tools..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_90%,transparent)] px-2.5 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-shadow [border:var(--border-default)] focus:ring-1 focus:ring-[var(--color-brand)]"
            />
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {filteredPhases.map((phase) => {
              const isOpen = !collapsedPhases.has(phase.id);
              const phaseMeta = getPhaseMeta(phase.id);
              const PhaseIcon = phaseMeta.icon;

              if (!phase.tools.length) {
                return null;
              }

              return (
                <div key={phase.id}>
                  <button
                    type="button"
                    onClick={() => togglePhase(phase.id)}
                    className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <PhaseIcon className={`h-3 w-3 ${phaseMeta.iconText}`} />
                      {phase.label}
                    </div>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    />
                  </button>

                  {isOpen &&
                    phase.tools.map((tool) => {
                      const isOnCanvas = canvasNodes.some((node) => node.toolId === tool.id);
                      const isCalculated = Boolean(snapshots[tool.id]);

                      return (
                        <div
                          key={tool.id}
                          className="group flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[var(--color-overlay-subtle)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <PhaseIcon className={`h-3 w-3 shrink-0 ${phaseMeta.iconText}`} />
                            <span className="truncate text-xs text-[var(--color-text)]/80">
                              {tool.name}
                            </span>
                            {isCalculated ? (
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${phaseMeta.dot}`} />
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => addNode(tool.id)}
                            disabled={isOnCanvas}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border opacity-0 transition-all group-hover:opacity-100 ${
                              isOnCanvas ? phaseMeta.buttonDisabled : phaseMeta.button
                            } disabled:cursor-not-allowed disabled:opacity-20`}
                            aria-label={`Add ${tool.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {!filteredPhases.some((phase) => phase.tools.length) ? (
              <div className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
                No tools match your search.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="order-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] backdrop-blur [border:var(--border-default)] lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 [border-color:rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3">
              <ShadBadge
                variant="outline"
                className="rounded-full border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-400"
              >
                Active
              </ShadBadge>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Workflow Canvas
                </span>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Drag nodes to inspect the project flow before generating the final report.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShadBadge variant="outline" className="rounded-full text-[10px]">
                {calculatedOnCanvas} Ready
              </ShadBadge>
              {canvasNodes.length > 0 ? (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] transition-colors hover:text-red-400"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>

          <div ref={canvasRef} className="relative flex-1 overflow-auto">
            {canvasNodes.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="rounded-xl border-2 border-dashed border-white/10 px-10 py-10 text-center">
                  <Workflow className="mx-auto mb-3 h-8 w-8 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">Add tools from the left panel</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">to build your report workflow</p>
                </div>
              </div>
            ) : null}

            <div
              className="relative"
              style={{ minWidth: contentSize.width, minHeight: contentSize.height }}
            >
              <svg
                className="pointer-events-none absolute left-0 top-0"
                width={contentSize.width}
                height={contentSize.height}
                style={{ overflow: "visible" }}
              >
                {connections.map(({ from, to }) => {
                  const fromPos = positions[from];
                  const toPos = positions[to];

                  if (!fromPos || !toPos) {
                    return null;
                  }

                  const startX = fromPos.x + NODE_WIDTH;
                  const startY = fromPos.y + NODE_HEIGHT / 2;
                  const endX = toPos.x;
                  const endY = toPos.y + NODE_HEIGHT / 2;
                  const cp1X = startX + (endX - startX) * 0.5;
                  const cp2X = endX - (endX - startX) * 0.5;
                  const path = `M${startX},${startY} C${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;

                  return (
                    <path
                      key={`${from}-${to}`}
                      d={path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeDasharray="8,6"
                      strokeLinecap="round"
                      opacity={0.3}
                      className="text-[var(--color-text)]"
                    />
                  );
                })}
              </svg>

              <AnimatePresence>
                {canvasNodes.map((node) => {
                  const tool = (REPORT_TOOL_DEFINITIONS as Array<{
                    id: string;
                    name: string;
                    href: string;
                    phase: string;
                  }>).find((item) => item.id === node.toolId);

                  if (!tool) {
                    return null;
                  }

                  return (
                    <WorkflowNode
                      key={node.id}
                      node={node}
                      tool={tool}
                      position={positions[node.id] ?? { x: 0, y: 0 }}
                      isCalculated={Boolean(snapshots[node.toolId])}
                      isSelected={selectedSections.has(node.toolId)}
                      statusLine={extractStatusLine(node.toolId, snapshots[node.toolId])}
                      onRemove={removeNode}
                      onToggle={toggleSection}
                      onDragStart={handleDragStart}
                      onDrag={handleDrag}
                      onDragEnd={handleDragEnd}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[var(--color-surface-secondary)] px-4 py-2.5 [border-color:rgba(255,255,255,0.08)]">
            <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {canvasNodes.length} {canvasNodes.length === 1 ? "Node" : "Nodes"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {connections.length} {connections.length === 1 ? "Connection" : "Connections"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                {calculatedOnCanvas} Ready · {selectedOnCanvas} Selected
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Drag nodes to reposition
            </p>
          </div>
        </div>

        <aside className="order-1 flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:order-3 lg:w-72">
          <PanelCard className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Project details
            </p>
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Project name</span>
                <input
                  type="text"
                  value={projectDetails.name}
                  onChange={(event) => updateProjectDetails("name", event.target.value)}
                  className={INPUT_CLASS_NAME}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Project location</span>
                <input
                  type="text"
                  value={projectDetails.location}
                  onChange={(event) => updateProjectDetails("location", event.target.value)}
                  className={INPUT_CLASS_NAME}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Client / company name</span>
                <input
                  type="text"
                  value={projectDetails.client}
                  onChange={(event) => updateProjectDetails("client", event.target.value)}
                  placeholder="Optional"
                  className={INPUT_CLASS_NAME}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Prepared by</span>
                <input
                  type="text"
                  value={projectDetails.preparedBy}
                  onChange={(event) => updateProjectDetails("preparedBy", event.target.value)}
                  placeholder="Optional"
                  className={INPUT_CLASS_NAME}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Report date</span>
                <input
                  type="date"
                  value={projectDetails.date}
                  onChange={(event) => updateProjectDetails("date", event.target.value)}
                  className={INPUT_CLASS_NAME}
                />
              </label>
            </div>
          </PanelCard>

          <PanelCard className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Report options
            </p>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2.5 [border:var(--border-default)]">
                <span className="text-xs text-[var(--color-text)]">Include executive summary</span>
                <input
                  type="checkbox"
                  checked={reportOptions.includeExecutiveSummary}
                  onChange={(event) =>
                    updateReportOptions("includeExecutiveSummary", event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2.5 [border:var(--border-default)]">
                <span className="text-xs text-[var(--color-text)]">Include methodology notes</span>
                <input
                  type="checkbox"
                  checked={reportOptions.includeMethodologyNotes}
                  onChange={(event) =>
                    updateReportOptions("includeMethodologyNotes", event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2.5 [border:var(--border-default)]">
                <span className="text-xs text-[var(--color-text)]">
                  Include input parameters appendix
                </span>
                <input
                  type="checkbox"
                  checked={reportOptions.includeInputAppendix}
                  onChange={(event) =>
                    updateReportOptions("includeInputAppendix", event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Report language</span>
                <select
                  value={reportOptions.language}
                  onChange={(event) =>
                    updateReportOptions("language", event.target.value as LanguageValue)
                  }
                  className={INPUT_CLASS_NAME}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text)]">Currency</span>
                <select
                  value={reportOptions.currency}
                  onChange={(event) =>
                    updateReportOptions("currency", event.target.value as CurrencyValue)
                  }
                  className={INPUT_CLASS_NAME}
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Display format only. No FX conversion is applied.
                </p>
              </label>
            </div>
          </PanelCard>

          <PanelCard className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Report output
            </p>
            <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
              <div className="flex justify-between">
                <span>Included sections</span>
                <span className="font-medium text-[var(--color-text)]">{selectedOnCanvas}</span>
              </div>
              <div className="flex justify-between">
                <span>Saved tool outputs</span>
                <span className="font-medium text-[var(--color-text)]">{calculatedOnCanvas}</span>
              </div>
              <p className="border-t pt-1 text-[10px] text-[var(--color-text-muted)] [border-color:rgba(255,255,255,0.08)]">
                The generator never reruns engineering calculations. It only reads the latest
                normalized snapshots saved by each Voltiq tool in your browser.
              </p>
            </div>
          </PanelCard>

          <div className="space-y-3">
            <div className={generatingAI || calculatedOnCanvas === 0 ? "pointer-events-none opacity-60" : ""}>
              <ActionButton onClick={() => generateSummary(true)} loading={generatingAI}>
                {generatingAI ? "Generating..." : "Generate executive summary"}
              </ActionButton>
            </div>
            <div className={generatingReport || calculatedOnCanvas === 0 ? "pointer-events-none opacity-60" : ""}>
              <ActionButton variant="outline" onClick={handleGenerateReport} loading={generatingReport}>
                {generatingReport ? "Generating PDF..." : "Generate full PDF report"}
              </ActionButton>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-4">
        <PanelCard>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-brand)]">
            Executive summary
          </p>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            Generate a project-wide narrative from the currently selected tool results.
          </p>
          {!executiveSummary && !generatingAI ? (
            <p className="text-sm italic text-[var(--color-text-muted)]">
              No summary generated yet. Generate the executive summary to preview the report
              narrative before exporting the final PDF.
            </p>
          ) : null}
          {generatingAI ? (
            <p className="animate-pulse text-sm text-[var(--color-text-muted)]">
              Generating executive summary...
            </p>
          ) : null}
          {executiveSummary ? (
            <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
              {executiveSummary}
            </div>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </PanelCard>
      </div>
    </section>
  );
}
