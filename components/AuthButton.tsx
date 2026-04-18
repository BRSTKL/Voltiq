"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { cn } from "@/lib/utils";

type AuthButtonProps = {
  fullWidth?: boolean;
};

function getUserInitial(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "V";
  return source.charAt(0).toUpperCase();
}

export default function AuthButton({ fullWidth = false }: AuthButtonProps) {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (status === "loading") {
    return (
      <div
        className={cn(
          "h-10 rounded-[var(--radius-md)] bg-[var(--color-overlay-subtle)]",
          fullWidth ? "w-full" : "w-24"
        )}
      />
    );
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 hover:bg-[var(--color-brand)] hover:text-white",
          fullWidth && "w-full"
        )}
      >
        Giris Yap
      </Link>
    );
  }

  const displayName =
    session.user.name || session.user.email?.split("@")[0] || "Voltiq User";

  return (
    <div
      ref={containerRef}
      className={cn("relative", fullWidth && "w-full")}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "inline-flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-overlay-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] shadow-sm transition-colors duration-200 hover:border-[var(--color-brand)]",
          fullWidth && "flex w-full justify-between"
        )}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-light)] text-sm font-semibold text-[var(--color-brand-dark)]">
            {getUserInitial(session.user.name, session.user.email)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold">{displayName}</span>
            <span className="block text-xs text-[var(--color-text-muted)]">
              {session.user.plan}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            "absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-overlay-subtle)] bg-[var(--color-surface)] shadow-[0_18px_48px_rgba(0,0,0,0.18)]",
            fullWidth && "left-0 w-full"
          )}
        >
          <div className="border-b border-[var(--color-overlay-subtle)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {displayName}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {session.user.email}
            </p>
          </div>

          <div className="p-2">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-overlay-subtle)]"
            >
              <LayoutDashboard className="h-4 w-4 text-[var(--color-brand)]" />
              Dashboard
            </Link>
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-overlay-subtle)]"
            >
              <UserRound className="h-4 w-4 text-[var(--color-brand)]" />
              Hesabim
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                void signOut({ redirectTo: "/" });
              }}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-overlay-subtle)]"
            >
              <LogOut className="h-4 w-4 text-[var(--color-brand)]" />
              Cikis
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
