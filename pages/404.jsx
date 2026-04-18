import Link from "next/link";

export default function Custom404() {
  return (
    <>
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-6xl font-bold text-[var(--color-brand)]">404</p>
          <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">
            Page not found
          </h1>
          <p className="mt-3 text-[var(--color-muted)]">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/"
              className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Go home
            </Link>
            <Link
              href="/tools"
              className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
            >
              Browse tools
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
