import Head from "next/head";
import Link from "next/link";
import ToolUsageGate from "../../components/ToolUsageGate";
import WindEnergyEstimator from "../../components/tools/WindEnergyEstimator";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getToolDefinition } from "@/lib/toolRegistry";

const toolMeta = getToolDefinition("wind");
const toolName = toolMeta?.name || "Wind Energy Estimator";
const categoryLabel = toolMeta?.categoryLabel || "Wind";
const toolDescription =
  toolMeta?.description ||
  "Weibull distribution, hub height scaling and turbine power curve yield";
const relatedTools = ["lcoe", "roi", "site-assessment"];

export default function WindToolPage() {
  const relatedToolDefinitions = relatedTools
    .map((toolSlug) => getToolDefinition(toolSlug))
    .filter(Boolean);

  return (
    <>
      <Head>
        <title>{toolName} | Voltiq</title>
        <meta name="description" content={toolDescription} />
      </Head>
      <div className="min-h-screen bg-[#0A0A0F]">
        <div className="border-b border-[#1E1E2E] px-4 py-3 lg:px-8">
          <div className="flex items-center">
            <Link href="/tools" className="text-sm text-[#9CA3AF] hover:text-[#F8F8F2]">
              {"\u2190 Ara\u00e7lar"}
            </Link>
            <span className="mx-2 text-[#6B7280]">{"\u203a"}</span>
            <span className="text-sm text-[#F8F8F2]">{toolName}</span>
          </div>
        </div>

        <div className="border-b border-[#1E1E2E] px-4 py-8 lg:px-8">
          <SectionHeader
            eyebrow={categoryLabel}
            title={toolName}
            description={toolDescription}
          />
        </div>

        <ToolUsageGate toolSlug="wind">
          <WindEnergyEstimator />
        </ToolUsageGate>

        <div className="border-t border-[#1E1E2E] px-4 py-10 lg:px-8">
          <p className="section-label mb-4">{"\u0130lgili Ara\u00e7lar"}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {relatedToolDefinitions.map((tool) => (
              <div
                key={tool.slug}
                className="card-surface flex h-full flex-col gap-4 p-4 transition-colors hover:border-[#F59E0B]"
              >
                <div>
                  <span className="inline-flex rounded-full border border-[#1E1E2E] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">
                    {tool.categoryLabel}
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-medium text-[#F8F8F2]">{tool.name}</h2>
                  <p className="truncate text-sm text-[#9CA3AF]">{tool.description}</p>
                </div>
                <Link
                  href={tool.href}
                  className="mt-auto inline-flex text-sm font-semibold text-[#F59E0B] transition-colors hover:text-[#F8F8F2]"
                >
                  {"A\u00e7 \u2192"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
