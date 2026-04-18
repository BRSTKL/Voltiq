import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import LCOEComparator from "@/components/tools/LCOEComparator";

export default function LCOEPage() {
  return (
    <>
      <Head>
        <title>LCOE Comparator - Voltiq</title>
        <meta
          name="description"
          content="Compare levelized cost of energy (LCOE) for solar, wind, gas and nuclear. CAPEX breakdown, sensitivity analysis and carbon pricing impact."
        />
      </Head>
      <ToolUsageGate toolSlug="lcoe">
        <LCOEComparator />
      </ToolUsageGate>
    </>
  );
}
