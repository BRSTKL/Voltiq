const TOOL_DEFINITIONS = [
  {
    slug: "site-assessment",
    name: "Site Assessment",
    categoryLabel: "Solar",
    description:
      "Solar project site suitability score - solar resource, grid access, terrain and regulatory risk",
    href: "/tools/site-assessment",
  },
  {
    slug: "solar",
    name: "Solar Yield Estimator",
    categoryLabel: "Solar",
    description:
      "Location-based annual yield with real climate data and system optimization",
    href: "/tools/solar",
  },
  {
    slug: "wind",
    name: "Wind Energy Estimator",
    categoryLabel: "Wind",
    description:
      "Weibull distribution, hub height scaling and turbine power curve yield",
    href: "/tools/wind",
  },
  {
    slug: "shading",
    name: "Shading Loss Analyzer",
    categoryLabel: "Solar",
    description:
      "Horizon diagram, sun path simulation and inverter-aware shading loss",
    href: "/tools/shading",
  },
  {
    slug: "pv-loss",
    name: "PV Loss Breakdown",
    categoryLabel: "Solar",
    description:
      "PVsyst-style loss diagram from gross irradiance to net AC output - loss waterfall, performance ratio and category breakdown.",
    href: "/tools/pv-loss",
  },
  {
    slug: "inverter-sizing",
    name: "Inverter Sizing",
    categoryLabel: "Solar",
    description:
      "Check PV string voltage window, DC current, inverter count, DC/AC ratio and clipping risk from the actual module layout.",
    href: "/tools/inverter-sizing",
  },
  {
    slug: "cable",
    name: "Cable Sizing Calculator",
    categoryLabel: "Electrical",
    description:
      "DC/AC cable cross-section per IEC 60364 with voltage drop, ampacity derating and annual energy loss.",
    href: "/tools/cable",
  },
  {
    slug: "battery",
    name: "Battery Storage Sizer",
    categoryLabel: "Storage",
    description:
      "LFP/NMC/Lead-acid comparison with DoD analysis and optimal capacity",
    href: "/tools/battery",
  },
  {
    slug: "storage-roi",
    name: "Storage ROI Calculator",
    categoryLabel: "Storage",
    description:
      "Battery investment viability across peak shaving, arbitrage, and backup value streams.",
    href: "/tools/storage-roi",
  },
  {
    slug: "roi",
    name: "Solar ROI Calculator",
    categoryLabel: "Financial",
    description:
      "25-year cumulative return, payback period and electricity price escalation",
    href: "/tools/roi",
  },
  {
    slug: "lcoe",
    name: "LCOE Comparator",
    categoryLabel: "Financial",
    description:
      "Compare levelized cost of energy for solar, wind, gas and nuclear - CAPEX breakdown, sensitivity analysis and carbon price impact.",
    href: "/tools/lcoe",
  },
  {
    slug: "carbon",
    name: "Carbon Intensity Tracker",
    categoryLabel: "Sustainability",
    description:
      "Real-time grid carbon intensity by country with energy mix, CO2 footprint and country comparison.",
    href: "/tools/carbon",
  },
  {
    slug: "land-use-capacity",
    name: "Land Use & Capacity Estimator",
    categoryLabel: "Solar",
    description:
      "Maximum installable capacity, panel count, and inverter pre-sizing from land area.",
    href: "/tools/land-use-capacity",
  },
  {
    slug: "scope2",
    name: "Scope 2 Calculator",
    categoryLabel: "Sustainability",
    description:
      "Corporate Scope 2 GHG reporting with location-based vs market-based emissions, RE instrument coverage, and SBTi tracking.",
    href: "/tools/scope2",
  },
  {
    slug: "hydrogen",
    name: "Green Hydrogen Calculator",
    categoryLabel: "Hydrogen",
    description:
      "Levelized cost of hydrogen via electrolysis with CAPEX, OPEX, electricity cost and carbon intensity.",
    href: "/tools/hydrogen",
  },
] as const;

export type ToolSlug = (typeof TOOL_DEFINITIONS)[number]["slug"];

export type ToolDefinition = (typeof TOOL_DEFINITIONS)[number];

const TOOL_REGISTRY = Object.fromEntries(
  TOOL_DEFINITIONS.map((tool) => [tool.slug, tool])
) as Record<ToolSlug, ToolDefinition>;

export const DEFAULT_QUICK_ACCESS_SLUGS: ToolSlug[] = ["solar", "battery", "roi"];

export const DEFAULT_QUICK_ACCESS_TOOLS = DEFAULT_QUICK_ACCESS_SLUGS.map(
  (slug) => TOOL_REGISTRY[slug]
);

export function getToolDefinitions() {
  return TOOL_DEFINITIONS;
}

export function getToolDefinition(toolSlug: string) {
  return TOOL_REGISTRY[toolSlug as ToolSlug] ?? null;
}

export function getToolName(toolSlug: string) {
  return getToolDefinition(toolSlug)?.name ?? toolSlug;
}

export function getToolHref(toolSlug: string) {
  return getToolDefinition(toolSlug)?.href ?? "/tools";
}

export function getSavedCalculationHref(toolSlug: string, id: string) {
  const baseHref = getToolHref(toolSlug);
  return `${baseHref}?savedCalculationId=${encodeURIComponent(id)}`;
}

export function buildSavedCalculationTitle(toolSlug: string, date = new Date()) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

  return `${getToolName(toolSlug)} - ${formattedDate}`;
}
