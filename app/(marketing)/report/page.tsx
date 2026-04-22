import ReportGenerator from "@/components/ReportGenerator";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Project Report Generator | Voltiq",
  description: "Combine all tool results into a single professional PDF report.",
};

export default function ReportPage() {
  return (
    <section className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
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
    </section>
  );
}
