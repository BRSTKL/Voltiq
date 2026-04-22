"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SaveCalculationButtonProps = {
  toolSlug: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  title?: string;
  disabled?: boolean;
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-spinner-track)] border-t-[var(--color-brand)]"
    />
  );
}

function SaveIcon() {
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
      <path d="M4.5 4.5h8l3 3v8a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M7 4.5v4h5v-4" />
      <path d="M7 15h6" />
    </svg>
  );
}

function getCallbackUrl(fallbackPath: string) {
  if (typeof window !== "undefined") {
    return `${window.location.pathname}${window.location.search}`;
  }

  return fallbackPath;
}

export default function SaveCalculationButton({
  toolSlug,
  inputData,
  outputData,
  title,
  disabled = false,
}: SaveCalculationButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSave() {
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/calculations/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toolSlug,
          inputData,
          outputData,
          title,
        }),
      });

      if (response.status === 401) {
        const currentSearch = searchParams?.toString();
        const callbackUrl = getCallbackUrl(
          pathname ? `${pathname}${currentSearch ? `?${currentSearch}` : ""}` : "/tools"
        );
        void router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Calculation could not be saved.");
        return;
      }

      setMessage("Calculation saved.");
    } catch {
      setIsError(true);
      setMessage("Calculation could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || isSaving}
        aria-busy={isSaving}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Spinner /> : <SaveIcon />}
        <span>{isSaving ? "Saving..." : "Save"}</span>
      </button>
      {message ? (
        <p
          className={`text-sm ${
            isError ? "text-red-500 dark:text-red-300" : "text-[var(--color-text-muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
