import Head from "next/head";
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
      <SiteAssessmentTool />
    </>
  );
}
