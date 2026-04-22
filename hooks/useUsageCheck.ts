"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { UsageCheckResult } from "@/lib/usage";

type UsageCheckOptions = {
  consume?: boolean;
};

function getCallbackUrl(fallbackPath: string) {
  if (typeof window !== "undefined") {
    return `${window.location.pathname}${window.location.search}`;
  }

  return fallbackPath || "/";
}

export default function useUsageCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const usageCheck = useCallback(
    async (
      toolSlug: string,
      options: UsageCheckOptions = {}
    ): Promise<UsageCheckResult> => {
      try {
        const response = await fetch("/api/check-usage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toolSlug,
            consume: options.consume === true,
          }),
        });

        if (response.status === 401) {
          const currentSearch = searchParams?.toString();
          const callbackUrl = getCallbackUrl(
            pathname ? `${pathname}${currentSearch ? `?${currentSearch}` : ""}` : "/tools"
          );
          void router.push(
            `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
          );

          return { allowed: false };
        }

        if (!response.ok) {
          return { allowed: false };
        }

        return (await response.json()) as UsageCheckResult;
      } catch {
        return { allowed: false };
      }
    },
    [pathname, router, searchParams]
  );

  return {
    usageCheck,
  };
}
