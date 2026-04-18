import Link from "next/link";

const productLinks = [
  { href: "/tools", label: "Tools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/tools/market-dashboard", label: "Market Dashboard" },
];

const companyLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

function LogoMark() {
  return <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-[#F59E0B]" />;
}

function SocialLink({ label, children }) {
  return (
    <a
      href="#"
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#6B7280] transition-colors duration-200 hover:text-[#F59E0B]"
    >
      {children}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#1E1E2E] bg-[#0A0A0F]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:pb-8">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center">
              <LogoMark />
              <span className="font-display text-[15px] font-bold tracking-[-0.03em] text-[#F8F8F2] sm:text-base">
                VOLTIQ
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-7 text-[var(--color-text-muted)]">
              Professional energy market analytics for Turkey&apos;s electricity market.
            </p>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">{"\u00A9"} 2025 Voltiq</p>
          </div>

          <div>
            <p className="section-label">PRODUCT</p>
            <nav className="mt-4 flex flex-col gap-3">
              {productLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[#F8F8F2]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="section-label">COMPANY</p>
            <nav className="mt-4 flex flex-col gap-3">
              {companyLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[#F8F8F2]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[#1E1E2E] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-[#6B7280]">Built for energy professionals</p>

          <div className="flex items-center gap-2">
            <SocialLink label="Twitter">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
                <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.25l-4.9-7.45L5.53 22H2.4l7.24-8.28L1.8 2h6.4l4.43 6.75L18.9 2Zm-1.1 18h1.73L7.26 3.9H5.4L17.8 20Z" />
              </svg>
            </SocialLink>
            <SocialLink label="LinkedIn">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
                <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.97 1.97 0 0 0 3.25 5c0 1.1.88 2 1.97 2h.03a1.99 1.99 0 1 0 0-4ZM20.75 13.02c0-3.33-1.78-4.88-4.15-4.88-1.91 0-2.77 1.05-3.25 1.8V8.5H9.97c.04.96 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.12-.92.27-.68.89-1.38 1.92-1.38 1.35 0 1.9 1.03 1.9 2.53V20h3.38v-6.98Z" />
              </svg>
            </SocialLink>
            <SocialLink label="GitHub">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current">
                <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.63.07-.63 1 .07 1.52 1.04 1.52 1.04.88 1.55 2.3 1.1 2.86.84.09-.66.34-1.1.62-1.36-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.7.12 2.5.36 1.9-1.33 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.95-2.34 4.81-4.58 5.07.36.31.68.92.68 1.86 0 1.34-.01 2.43-.01 2.76 0 .28.18.61.69.5A10.3 10.3 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
              </svg>
            </SocialLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
