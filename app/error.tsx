"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-red-500">500</p>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">
          Something went wrong
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          We encountered an unexpected error. Please try again later or contact support
          if the problem persists.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/contact"
            className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
          >
            Contact support
          </Link>
        </div>
      </div>
    </main>
  );
}
