"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppNavProps = {
  children?: ReactNode;
};

export default function AppNav({ children }: AppNavProps) {
  const pathname = usePathname();
  const isDashboardRoute = pathname?.startsWith("/dashboard");

  return (
    <header className="border-b border-[#1E1E2E] bg-[#0A0A0F]">
      <div className="mx-auto flex h-[60px] w-full max-w-5xl items-center justify-between px-4 lg:px-8">
        <Link
          href="/"
          aria-label={isDashboardRoute ? "Voltiq ana sayfasi" : "Voltiq"}
          className="inline-flex items-center"
        >
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-2 w-2 bg-[#F59E0B]"
          />
          <span className="font-display text-[15px] font-bold tracking-[-0.03em] text-[#F8F8F2] sm:text-base">
            VOLTIQ
          </span>
        </Link>

        <div className="flex min-w-0 items-center justify-end">{children}</div>
      </div>
    </header>
  );
}
