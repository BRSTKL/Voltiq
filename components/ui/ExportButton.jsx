import { useState } from "react";
import { exportToPDF } from "@/lib/pdfExport";

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
    />
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3.5v8" />
      <path d="m6.75 8.75 3.25 3.5 3.25-3.5" />
      <path d="M4 15.5h12" />
    </svg>
  );
}

export default function ExportButton({ toolName, data, disabled = false }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!data || disabled || exporting) {
      return;
    }

    setExporting(true);

    try {
      await exportToPDF(toolName, data);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled || exporting || !data}
      aria-busy={exporting}
      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 [border:var(--border-default)] [border-color:var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] hover:bg-[var(--color-brand-light)] dark:hover:bg-[color:color-mix(in_srgb,var(--color-brand)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {exporting ? <Spinner /> : <DownloadIcon />}
      <span>{exporting ? "Generating PDF..." : "Export PDF ↓"}</span>
    </button>
  );
}
