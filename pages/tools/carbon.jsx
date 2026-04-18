import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import CarbonIntensityTracker from "@/components/tools/CarbonIntensityTracker";

export default function CarbonPage() {
  return (
    <>
      <Head>
        <title>Carbon Intensity Tracker - Voltiq</title>
        <meta
          name="description"
          content="Real-time electricity grid carbon intensity by country. Energy mix visualization, CO2 footprint calculator and country comparison."
        />
      </Head>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <ToolUsageGate toolSlug="carbon">
          <CarbonIntensityTracker />
        </ToolUsageGate>
      </main>
    </>
  );
}
