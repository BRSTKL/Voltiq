import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  Battery100Icon,
  BeakerIcon,
  BoltIcon,
  CurrencyDollarIcon,
  CubeTransparentIcon,
  GlobeEuropeAfricaIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { PanelCard } from "../../components/ui";

const filters = [
  { label: "All", value: "all" },
  { label: "Solar", value: "solar" },
  { label: "Wind", value: "wind" },
  { label: "Hydrogen", value: "hydrogen" },
  { label: "Electrical", value: "electrical" },
  { label: "Sustainability", value: "sustainability" },
  { label: "Storage", value: "storage" },
  { label: "Financial", value: "financial" },
];

const toolColorClasses = {
  "#E1F5EE": "bg-[#E1F5EE] dark:bg-[rgba(29,158,117,0.16)]",
  "#E6F1FB": "bg-[#E6F1FB] dark:bg-[rgba(24,95,165,0.18)]",
  "#FAEEDA": "bg-[#FAEEDA] dark:bg-[rgba(133,79,11,0.18)]",
  "#EEEDFE": "bg-[#EEEDFE] dark:bg-[rgba(83,74,183,0.18)]",
  "#EAF3DE": "bg-[#EAF3DE] dark:bg-[rgba(59,109,17,0.16)]",
};

const toolIconClasses = {
  "#1D9E75": "text-[#1D9E75]",
  "#185FA5": "text-[#185FA5]",
  "#854F0B": "text-[#854F0B]",
  "#534AB7": "text-[#534AB7]",
  "#0F6E56": "text-[#0F6E56]",
  "#3B6D11": "text-[#3B6D11]",
};

const categoryBadgeClasses = {
  solar: "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]",
  wind: "bg-[var(--badge-teal-bg)] text-[var(--badge-teal-text)]",
  hydrogen: "bg-[var(--badge-teal-bg)] text-[var(--badge-teal-text)]",
  electrical: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
  sustainability: "bg-[#EAF3DE] text-[#3B6D11]",
  storage: "bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]",
  financial: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
};

const difficultyBadgeClasses = {
  easy: "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]",
  medium: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
  hard: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200",
};

const tools = [
  {
    name: "Site Assessment",
    desc: "Solar project site suitability score - solar resource, grid access, terrain and regulatory risk",
    category: "solar",
    difficulty: "easy",
    apis: "Open-Meteo + Gemini",
    href: "/tools/site-assessment",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    Icon: MapPinIcon,
    isNew: true,
  },
  {
    name: "PV Loss Breakdown",
    desc: "PVsyst-style loss diagram from gross irradiance to net AC output - loss waterfall, performance ratio and category breakdown.",
    category: "solar",
    difficulty: "medium",
    apis: "Open-Meteo + Gemini",
    href: "/tools/pv-loss",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    Icon: SunIcon,
    isNew: true,
  },
  {
    name: "Inverter Sizing",
    desc: "Check PV string voltage window, DC current, inverter count, DC/AC ratio and clipping risk from the actual module layout.",
    category: "solar",
    difficulty: "medium",
    apis: "Pure calculation + Gemini",
    href: "/tools/inverter-sizing",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    Icon: BoltIcon,
    isNew: true,
  },
  {
    name: "Solar Yield Estimator",
    desc: "Location-based annual yield with real climate data and system optimization",
    category: "solar",
    difficulty: "medium",
    apis: "Open-Meteo archive",
    href: "/tools/solar",
    color: "#E1F5EE",
    iconColor: "#1D9E75",
    Icon: SunIcon,
  },
  {
    name: "Battery Storage Sizer",
    desc: "LFP/NMC/Lead-acid comparison with DoD analysis and optimal capacity",
    category: "storage",
    difficulty: "easy",
    apis: "Sizing engine",
    href: "/tools/battery",
    color: "#E6F1FB",
    iconColor: "#185FA5",
    Icon: Battery100Icon,
  },
  {
    name: "Storage ROI Calculator",
    desc: "Battery investment viability across peak shaving, arbitrage, and backup value streams.",
    category: "storage",
    difficulty: "medium",
    apis: "Pure calculation + Gemini",
    href: "/tools/storage-roi",
    color: "#E6F1FB",
    iconColor: "#185FA5",
    Icon: CurrencyDollarIcon,
    isNew: true,
  },
  {
    name: "Green H2 Calculator",
    desc: "Levelized cost of hydrogen via electrolysis with CAPEX, OPEX, electricity cost and carbon intensity.",
    category: "hydrogen",
    difficulty: "medium",
    apis: "Pure calculation + Gemini",
    href: "/tools/hydrogen",
    color: "#E1F5EE",
    iconColor: "#0F6E56",
    Icon: BeakerIcon,
    isNew: true,
  },
  {
    name: "Cable Sizing Calculator",
    desc: "DC/AC cable cross-section per IEC 60364 with voltage drop, ampacity derating and annual energy loss.",
    category: "electrical",
    difficulty: "medium",
    apis: "Pure calculation + Gemini",
    href: "/tools/cable",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    Icon: BoltIcon,
    isNew: true,
  },
  {
    name: "Carbon Intensity Tracker",
    desc: "Real-time grid carbon intensity by country with energy mix, CO2 footprint and country comparison.",
    category: "sustainability",
    difficulty: "easy",
    apis: "Electricity Maps + Gemini",
    href: "/tools/carbon",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    Icon: GlobeEuropeAfricaIcon,
    isNew: true,
  },
  {
    name: "Scope 2 Calculator",
    desc: "Corporate Scope 2 GHG reporting with location-based vs market-based emissions, RE instrument coverage, and SBTi tracking.",
    category: "sustainability",
    difficulty: "easy",
    apis: "Pure calculation + Gemini",
    href: "/tools/scope2",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    Icon: GlobeEuropeAfricaIcon,
    isNew: true,
  },
  {
    name: "LCOE Comparator",
    desc: "Compare levelized cost of energy for solar, wind, gas and nuclear - CAPEX breakdown, sensitivity analysis and carbon price impact.",
    category: "financial",
    difficulty: "medium",
    apis: "Pure calculation + Gemini",
    href: "/tools/lcoe",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    Icon: CurrencyDollarIcon,
    isNew: true,
  },
  {
    name: "Solar ROI Calculator",
    desc: "25-year cumulative return, payback period and electricity price escalation",
    category: "financial",
    difficulty: "easy",
    apis: "Pure calculation",
    href: "/tools/roi",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    Icon: CurrencyDollarIcon,
  },
  {
    name: "Shading Loss Analyzer",
    desc: "Horizon diagram, sun path simulation and inverter-aware shading loss",
    category: "solar",
    difficulty: "medium",
    apis: "Simulation engine",
    href: "/tools/shading",
    color: "#EEEDFE",
    iconColor: "#534AB7",
    Icon: CubeTransparentIcon,
  },
  {
    name: "Wind Energy Estimator",
    desc: "Weibull distribution, hub height scaling and turbine power curve yield",
    category: "wind",
    difficulty: "hard",
    apis: "Open-Meteo archive",
    href: "/tools/wind",
    color: "#E1F5EE",
    iconColor: "#0F6E56",
    Icon: PaperAirplaneIcon,
  },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

function LabelPill({ children, className = "" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] [border:var(--border-default)]",
        className
      )}
    >
      {children}
    </span>
  );
}

function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ToolCard({ tool }) {
  const Icon = tool.Icon;

  return (
    <PanelCard className="flex h-full flex-col gap-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[10px]",
            toolColorClasses[tool.color]
          )}
        >
          <Icon className={cn("h-5 w-5", toolIconClasses[tool.iconColor])} />
        </div>
        {tool.isNew ? (
          <LabelPill className="bg-[var(--badge-teal-bg)] text-[var(--badge-teal-text)]">
            New tool
          </LabelPill>
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-[15px] font-medium text-[var(--color-text)]">{tool.name}</h2>
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">{tool.desc}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <LabelPill className={categoryBadgeClasses[tool.category]}>{formatLabel(tool.category)}</LabelPill>
        <LabelPill className={difficultyBadgeClasses[tool.difficulty]}>
          {formatLabel(tool.difficulty)}
        </LabelPill>
      </div>

      <p className="text-[12px] text-[var(--color-text-muted)]">{tool.apis}</p>

      <Link
        href={tool.href}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]"
      >
        <span>Open tool</span>
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </PanelCard>
  );
}

export default function ToolsPage() {
  const [activeFilter, setActiveFilter] = useState("all");

  const visibleTools =
    activeFilter === "all"
      ? tools
      : tools.filter((tool) => tool.category === activeFilter);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-20">
      <PanelCard className="mb-8 flex flex-col gap-3 bg-[var(--color-brand-light)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
            Project workflow
          </p>
          <p className="mt-2 text-base font-semibold text-[var(--color-text)]">
            Have you run all your calculations?
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
            Generate a complete project report from the latest saved outputs across all Voltiq tools.
          </p>
        </div>
        <Link
          href="/report"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
        >
          <span>Generate report</span>
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </PanelCard>

      <div className="max-w-3xl">
        <h1 className="text-[34px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
          Engineering tools
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-muted)]">Select a tool to begin</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 border-b border-black/0 [border-bottom:var(--border-default)]">
        {filters.map((filter) => {
          const isActive = filter.value === activeFilter;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        {visibleTools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </main>
  );
}
