const TOOL_DEFINITIONS = [
  {
    slug: "site-assessment",
    name: "Site Assessment",
    href: "/tools/site-assessment",
  },
  {
    slug: "solar",
    name: "Solar Yield Estimator",
    href: "/tools/solar",
  },
  {
    slug: "wind",
    name: "Wind Energy Estimator",
    href: "/tools/wind",
  },
  {
    slug: "shading",
    name: "Shading Loss Analyzer",
    href: "/tools/shading",
  },
  {
    slug: "pv-loss",
    name: "PV Loss Breakdown",
    href: "/tools/pv-loss",
  },
  {
    slug: "inverter-sizing",
    name: "Inverter Sizing",
    href: "/tools/inverter-sizing",
  },
  {
    slug: "cable",
    name: "Cable Sizing Calculator",
    href: "/tools/cable",
  },
  {
    slug: "battery",
    name: "Battery Storage Sizer",
    href: "/tools/battery",
  },
  {
    slug: "storage-roi",
    name: "Storage ROI Calculator",
    href: "/tools/storage-roi",
  },
  {
    slug: "roi",
    name: "Solar ROI Calculator",
    href: "/tools/roi",
  },
  {
    slug: "lcoe",
    name: "LCOE Comparator",
    href: "/tools/lcoe",
  },
  {
    slug: "carbon",
    name: "Carbon Intensity Tracker",
    href: "/tools/carbon",
  },
  {
    slug: "land-use-capacity",
    name: "Land Use & Capacity Estimator",
    href: "/tools/land-use-capacity",
  },
  {
    slug: "scope2",
    name: "Scope 2 Calculator",
    href: "/tools/scope2",
  },
  {
    slug: "hydrogen",
    name: "Green Hydrogen Calculator",
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
