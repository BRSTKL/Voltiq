import Link from "next/link";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="mt-auto [border-top:var(--border-default)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-[12px] text-[var(--color-text-muted)] sm:flex-row sm:px-6 sm:text-left">
        <p className="sm:whitespace-nowrap">{"\u00A9 2025 Voltiq \u2014 Built for energy engineers"}</p>
        <nav className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-[var(--color-brand)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
