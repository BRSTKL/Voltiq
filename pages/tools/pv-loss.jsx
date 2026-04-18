import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import PVLossBreakdown from "@/components/tools/PVLossBreakdown";

export default function PVLossPage() {
  return (
    <>
      <Head>
        <title>PV Loss Breakdown - Voltiq</title>
        <meta
          name="description"
          content="PVsyst-style PV loss chain from gross irradiance to net AC output with performance ratio, waterfall analysis, and AI recommendations."
        />
      </Head>
      <ToolUsageGate toolSlug="pv-loss">
        <PVLossBreakdown />
      </ToolUsageGate>
    </>
  );
}
