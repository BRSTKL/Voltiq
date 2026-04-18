import Link from "next/link";

export default function Custom500() {
  return (
    <>
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-6xl font-bold text-red-500">500</p>
          <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">
            Something went wrong
          </h1>
          <p className="mt-3 text-[var(--color-muted)]">
            We encountered an unexpected error. Please try again later or
            contact support if the problem persists.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/"
              className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Go home
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
