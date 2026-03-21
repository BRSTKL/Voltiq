import Head from "next/head";
import ReportGenerator from "@/components/ReportGenerator";

export default function ReportPage() {
  return (
    <>
      <Head>
        <title>Project Report Generator - Voltiq</title>
        <meta
          name="description"
          content="Combine your Voltiq tool outputs into a single professional solar project feasibility report with executive summary and appendix."
        />
      </Head>
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-20">
        <ReportGenerator />
      </main>
    </>
  );
}
