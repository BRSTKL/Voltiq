import dynamic from "next/dynamic";
import Head from "next/head";
import { Badge } from "@/components/ui/badge";

const ReportGenerator = dynamic(() => import("../components/ReportGenerator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-gray-600">
      Loading report builder...
    </div>
  ),
});

export default function ReportPage() {
  return (
    <>
      <Head>
        <title>Project Report Generator — Voltiq</title>
        <meta
          name="description"
          content="Combine all tool results into a single professional PDF report."
        />
      </Head>
      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-green-400/40 bg-green-400/10 text-xs text-green-400"
            >
              Flagship feature
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-blue-400/40 bg-blue-400/10 text-xs text-blue-400"
            >
              Workflow canvas
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-purple-400/40 bg-purple-400/10 text-xs text-purple-400"
            >
              Gemini executive summary
            </Badge>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Solar Project Report Generator
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Combine all tool results into a single professional PDF report.
          </p>
        </div>
        <ReportGenerator />
      </main>
    </>
  );
}
