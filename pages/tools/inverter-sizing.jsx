import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import InverterSizingTool from "@/components/tools/InverterSizingTool";

export default function InverterSizingPage() {
  return (
    <>
      <Head>
        <title>Inverter Sizing - Voltiq</title>
        <meta
          name="description"
          content="PV inverter sizing with string voltage checks, DC/AC ratio optimization, clipping estimates, and AI engineering review."
        />
      </Head>
      <ToolUsageGate toolSlug="inverter-sizing">
        <InverterSizingTool />
      </ToolUsageGate>
    </>
  );
}
