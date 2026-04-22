import type { ComponentType } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import ToolUsageGate from "@/components/ToolUsageGate";
import { getToolDefinition, getToolDefinitions } from "@/lib/toolRegistry";

type ToolModule = {
  default: ComponentType<any>;
};

const TOOL_COMPONENTS: Record<string, () => Promise<ToolModule>> = {
  solar: () => import("@/components/tools/SolarYieldEstimator"),
  battery: () => import("@/components/tools/BatteryStorageSizer"),
  roi: () => import("@/components/tools/ROICalculator"),
  wind: () => import("@/components/tools/WindEnergyEstimator"),
  lcoe: () => import("@/components/tools/LCOEComparator"),
  imbalance: () => import("@/components/tools/ImbalanceSimulator"),
  shading: () => import("@/components/tools/ShadingLossAnalyzer"),
  "pv-loss": () => import("@/components/tools/PVLossBreakdown"),
  "inverter-sizing": () => import("@/components/tools/InverterSizingTool"),
  cable: () => import("@/components/tools/CableSizingTool"),
  carbon: () => import("@/components/tools/CarbonIntensityTracker"),
  hydrogen: () => import("@/components/tools/GreenHydrogenCalculator"),
  scope2: () => import("@/components/tools/Scope2Calculator"),
  "land-use-capacity": () => import("@/components/tools/LandUseCapacityEstimator"),
  "storage-roi": () => import("@/components/tools/StorageROICalculator"),
  "site-assessment": () => import("@/components/tools/SiteAssessmentTool"),
  "market-dashboard": () => import("@/components/tools/MarketDashboard"),
};

const EXTRA_TOOLS = {
  "market-dashboard": {
    title: "Turkiye PTF Dashboard",
    description:
      "Canli EPIAS gun oncesi fiyat verisi, saatlik PTF grafikleri ve 24 saatlik tahmin.",
  },
} as const;

type ToolPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return [
    ...getToolDefinitions().map((tool) => ({ slug: tool.slug })),
    { slug: "market-dashboard" },
  ];
}

export function generateMetadata({ params }: ToolPageProps) {
  const tool = getToolDefinition(params.slug);

  if (tool) {
    return {
      title: `${tool.name} | Voltiq`,
      description: tool.description,
    };
  }

  const extraTool = EXTRA_TOOLS[params.slug as keyof typeof EXTRA_TOOLS];

  if (extraTool) {
    return {
      title: `${extraTool.title} | Voltiq`,
      description: extraTool.description,
    };
  }

  return {};
}

export default async function ToolPage({ params }: ToolPageProps) {
  const tool = getToolDefinition(params.slug);
  const extraTool = EXTRA_TOOLS[params.slug as keyof typeof EXTRA_TOOLS];

  if (!tool && !extraTool) {
    notFound();
  }

  const componentLoader = TOOL_COMPONENTS[params.slug];

  if (!componentLoader) {
    notFound();
  }

  const { default: ToolComponent } = await componentLoader();

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-[var(--color-text-muted)] lg:px-8">
          Loading tool...
        </div>
      }
    >
      <ToolUsageGate toolSlug={params.slug}>
        <ToolComponent />
      </ToolUsageGate>
    </Suspense>
  );
}
