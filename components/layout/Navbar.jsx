import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import AuthButton from "../AuthButton";

const navigationItems = [
  { href: "/tools", label: "Tools", match: (pathname) => pathname.startsWith("/tools") },
  { href: "/pricing", label: "Pricing", match: (pathname) => pathname === "/pricing" },
  { href: "/docs", label: "Docs", match: (pathname) => pathname.startsWith("/docs") },
];

const cn = (...classes) => classes.filter(Boolean).join(" ");

function LogoMark() {
  return <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-[#F59E0B]" />;
}

function NavLink({ href, label, active, onClick, mobile = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "transition-colors duration-200",
        mobile
          ? "block w-full border-b border-[#1E1E2E] py-3 text-sm text-[#9CA3AF] hover:text-[#F8F8F2]"
          : "border-b-2 pb-[2px] text-sm text-[#9CA3AF] hover:text-[#F8F8F2]",
        active ? "border-[#F59E0B] text-[#F59E0B]" : "border-transparent"
      )}
    >
      {label}
    </Link>
  );
}

function MarketLink({ mobile = false, onClick }) {
  return (
    <Link
      href="/tools/market-dashboard"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md bg-[#F59E0B] text-xs font-semibold text-black transition-colors duration-200 hover:bg-[#D97706]",
        mobile ? "w-full justify-between px-3 py-2.5" : "px-3 py-1.5"
      )}
    >
      <span className="inline-flex items-start gap-1.5">
        <span>{"\u26A1"} Market</span>
        <span className="inline-flex rounded-sm border border-[#F59E0B] bg-[#1A1A24] px-1 py-0.5 text-[9px] leading-none text-[#F59E0B]">
          BETA
        </span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [router.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#1E1E2E] bg-[rgba(10,10,15,0.88)] backdrop-blur-[14px]">
      <div className="relative mx-auto flex h-[60px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center">
          <Link href="/" className="inline-flex items-center">
            <LogoMark />
            <span className="font-display text-[15px] font-bold tracking-[-0.03em] text-[#F8F8F2] sm:text-base">
              VOLTIQ
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {navigationItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(router.pathname)}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <MarketLink />
          <AuthButton />
        </div>

        <button
          type="button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-md p-2 text-[#F8F8F2] transition-colors duration-200 hover:bg-[#111118] md:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>

        {isMenuOpen ? (
          <div className="absolute left-0 top-[60px] w-full border-b border-[#1E1E2E] bg-[#111118] p-4 md:hidden">
            <nav className="flex flex-col">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={item.match(router.pathname)}
                  onClick={() => setIsMenuOpen(false)}
                  mobile
                />
              ))}
              <div className="pt-4">
                <MarketLink mobile onClick={() => setIsMenuOpen(false)} />
              </div>
              <div className="pt-4">
                <AuthButton fullWidth />
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
