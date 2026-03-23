import Head from "next/head";
import LandUseCapacityEstimator from "../../components/tools/LandUseCapacityEstimator";

export default function LandUseCapacityPage() {
  return (
    <>
      <Head>
        <title>Land Use & Capacity Estimator — Voltiq</title>
        <meta
          name="description"
          content="Maximum installable capacity, panel count, and inverter pre-sizing from land area."
        />
      </Head>
      <LandUseCapacityEstimator />
    </>
  );
}
