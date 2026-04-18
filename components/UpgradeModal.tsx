"use client";

import Link from "next/link";
import { ArrowRight, Lock, Sparkles, X } from "lucide-react";

import type { UsageLimitReason } from "@/lib/usage";

type UpgradeModalProps = {
  open: boolean;
  reason: UsageLimitReason | null;
  onClose: () => void;
};

const proFeatures = [
  "Access to all Voltiq engineering tools",
  "Unlimited calculations and all workflows",
  "AI analyses, reports, and premium outputs",
];

export default function UpgradeModal({
  open,
  reason,
  onClose,
}: UpgradeModalProps) {
  if (!open || !reason) {
    return null;
  }

  const isToolLocked = reason === "tool_locked";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#07110e]/78 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1b17] p-6 text-[#E5F4EE] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#9BB5AC] transition-colors duration-200 hover:bg-white/10 hover:text-white"
          aria-label="Close upgrade modal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#9FE3CC]">
          {isToolLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isToolLocked ? "Pro feature" : "Daily quota reached"}
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">
            {isToolLocked
              ? "This tool requires a Pro plan"
              : "You have reached your daily limit (20/20)"}
          </h2>
          <p className="text-sm leading-7 text-[#A7C2B8]">
            {isToolLocked
              ? "Upgrade to Pro to unlock all Voltiq tools and keep your engineering workflow in one place."
              : "Try again tomorrow or upgrade to Pro for unlimited calculations and full tool access."}
          </p>
        </div>

        {isToolLocked ? (
          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7FB8A7]">
              What you get with Pro
            </p>
            <ul className="mt-4 space-y-3 text-sm text-[#D9ECE5]">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#1D9E75]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)]"
          >
            Upgrade to Pro
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#D5E8E1] transition-colors duration-200 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
