import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import GreenHydrogenCalculator from "../../components/tools/GreenHydrogenCalculator";

export default function HydrogenToolPage() {
  return (
    <>
      <Head>
        <title>Green Hydrogen Calculator - Voltiq</title>
        <meta
          name="description"
          content="Calculate the levelized cost of green hydrogen production via electrolysis, including LCOH, CAPEX, carbon intensity, and sensitivity analysis."
        />
      </Head>
      <ToolUsageGate toolSlug="hydrogen">
        <GreenHydrogenCalculator />
      </ToolUsageGate>
    </>
  );
}
