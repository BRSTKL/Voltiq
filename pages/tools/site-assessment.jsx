import Head from "next/head";
import ToolUsageGate from "../../components/ToolUsageGate";
import SiteAssessmentTool from "@/components/tools/SiteAssessmentTool";

export default function SiteAssessmentPage() {
  return (
    <>
      <Head>
        <title>Site Assessment - Voltiq</title>
        <meta
          name="description"
          content="Solar project site suitability scoring - solar resource, grid access, terrain and regulatory analysis with AI recommendations."
        />
      </Head>
      <ToolUsageGate toolSlug="site-assessment">
        <SiteAssessmentTool />
      </ToolUsageGate>
    </>
  );
}
