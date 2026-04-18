"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import UpgradeModal from "@/components/UpgradeModal";
import useUsageCheck from "@/hooks/useUsageCheck";
import type { UsageCheckResult, UsageLimitReason } from "@/lib/usage";
import { cn } from "@/lib/utils";

type ToolUsageGateContextValue = {
  isBlocked: boolean;
  reason: UsageLimitReason | null;
  requestUsageAccess: () => Promise<UsageCheckResult>;
};

type ToolUsageGateProps = {
  toolSlug: string;
  children: ReactNode;
};

const ToolUsageGateContext = createContext<ToolUsageGateContextValue | null>(
  null
);

export function useToolUsageGate() {
  return useContext(ToolUsageGateContext);
}

export default function ToolUsageGate({
  toolSlug,
  children,
}: ToolUsageGateProps) {
  const { usageCheck } = useUsageCheck();
  const [reason, setReason] = useState<UsageLimitReason | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function runPrecheck() {
      setIsChecking(true);

      const result = await usageCheck(toolSlug, { consume: false });

      if (!isMounted) {
        return;
      }

      if (!result.allowed && result.reason) {
        setReason(result.reason);
        setIsModalOpen(true);
      } else {
        setReason(null);
      }

      setIsChecking(false);
    }

    void runPrecheck();

    return () => {
      isMounted = false;
    };
  }, [toolSlug, usageCheck]);

  async function requestUsageAccess() {
    const result = await usageCheck(toolSlug, { consume: true });

    if (!result.allowed && result.reason) {
      setReason(result.reason);
      setIsModalOpen(true);
    } else {
      setReason(null);
    }

    return result;
  }

  const isBlocked = reason !== null;

  return (
    <ToolUsageGateContext.Provider
      value={{
        isBlocked,
        reason,
        requestUsageAccess,
      }}
    >
      <div className="relative">
        <div
          className={cn(
            "transition-[filter,opacity] duration-200",
            isChecking && "opacity-95",
            isBlocked && "pointer-events-none select-none blur-[4px] opacity-45"
          )}
          aria-hidden={isBlocked}
        >
          {children}
        </div>

        {isBlocked ? (
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[color:color-mix(in_srgb,var(--color-bg)_72%,transparent)]" />
        ) : null}

        <UpgradeModal
          open={isModalOpen}
          reason={reason}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </ToolUsageGateContext.Provider>
  );
}
