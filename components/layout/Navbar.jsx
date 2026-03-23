import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const navigationItems = [
  { href: "/tools", label: "Tools", match: (pathname) => pathname.startsWith("/tools") },
  { href: "/pricing", label: "Pricing", match: (pathname) => pathname === "/pricing" },
  { href: "/docs", label: "Docs", match: (pathname) => pathname.startsWith("/docs") },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
    >
      <path d="M13.2 2.75a.75.75 0 0 0-.7.43L7.9 12.9a.75.75 0 0 0 .68 1.07h3.2l-1.34 7.11a.75.75 0 0 0 1.39.5l5.52-10.28a.75.75 0 0 0-.66-1.1h-3.08l1.85-6.47a.75.75 0 0 0-.72-.98H13.2Z" />
    </svg>
  );
}

function HamburgerIcon({ open }) {
  return open ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function NavLink({ href, label, active, onClick, mobile = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "text-sm font-medium transition-colors duration-200",
        mobile ? "block rounded-[var(--radius-md)] px-3 py-2" : "",
        active
          ? "text-[var(--color-brand)]"
          : "text-[var(--color-text)] hover:text-[var(--color-brand)]"
      )}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [router.asPath]);

  const pathname = router.pathname;

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-surface)]/95 backdrop-blur [border-bottom:var(--border-default)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white shadow-sm sm:h-10 sm:w-10">
            <BoltIcon />
          </span>
          <span className="truncate text-lg font-semibold tracking-[-0.03em] sm:text-xl">
            <span className="text-[var(--color-text)]">volt</span>
            <span className="text-[var(--color-brand)]">iq</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(pathname)}
            />
          ))}
        </nav>

        <div className="hidden md:block">
          <div className="flex items-center gap-3">
            <Link
              href="/report"
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
            >
              Generate Report
            </Link>
          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 hover:bg-[var(--color-brand)] hover:text-white"
          >
            Start free
          </Link>
          </div>
        </div>

        <button
          type="button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] p-2 text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-overlay-subtle)] md:hidden"
        >
          <HamburgerIcon open={isMenuOpen} />
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden px-4 transition-all duration-200 sm:px-6 md:hidden",
          isMenuOpen
            ? "max-h-80 pb-5 opacity-100 [border-top:var(--border-default)]"
            : "max-h-0 pb-0 opacity-0"
        )}
      >
        <nav className="flex flex-col gap-1 pt-3">
          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(pathname)}
              onClick={() => setIsMenuOpen(false)}
              mobile
            />
          ))}
          <Link
            href="/report"
            onClick={() => setIsMenuOpen(false)}
            className="mt-2 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
          >
            Generate Report
          </Link>
          <Link
            href="/tools"
            onClick={() => setIsMenuOpen(false)}
            className="mt-2 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 hover:bg-[var(--color-brand)] hover:text-white"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}
