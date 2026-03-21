import Head from "next/head";
import CableSizingTool from "../../components/tools/CableSizingTool";

export default function CableToolPage() {
  return (
    <>
      <Head>
        <title>Cable Sizing Calculator - Voltiq</title>
        <meta
          name="description"
          content="DC and AC cable cross-section sizing per IEC 60364. Voltage drop, ampacity derating, and annual energy loss for renewable energy systems."
        />
      </Head>
      <CableSizingTool />
    </>
  );
}
