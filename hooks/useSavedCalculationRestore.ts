"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SavedCalculationRecord = {
  id: string;
  toolSlug: string;
  title: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  createdAt: string;
};

function getCallbackUrl(fallbackPath: string) {
  if (typeof window !== "undefined") {
    return `${window.location.pathname}${window.location.search}`;
  }

  return fallbackPath;
}

export default function useSavedCalculationRestore(
  toolSlug: string,
  onRestore: (savedCalculation: SavedCalculationRecord) => void,
  onError?: (message: string) => void
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoreRef = useRef(onRestore);
  const errorRef = useRef(onError);
  const processedIdRef = useRef<string | null>(null);

  useEffect(() => {
    restoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const savedCalculationId = searchParams?.get("savedCalculationId");

    if (typeof savedCalculationId !== "string") {
      return;
    }

    if (processedIdRef.current === savedCalculationId) {
      return;
    }

    processedIdRef.current = savedCalculationId;

    let isActive = true;

    async function restoreSavedCalculation() {
      try {
        const response = await fetch(`/api/calculations/${savedCalculationId}`);

        if (response.status === 401) {
          const currentSearch = searchParams?.toString();
          const callbackUrl = getCallbackUrl(
            pathname ? `${pathname}${currentSearch ? `?${currentSearch}` : ""}` : "/tools"
          );
          void router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          return;
        }

        const payload = (await response.json()) as
          | SavedCalculationRecord
          | { error?: string };

        if (!response.ok) {
          if (isActive) {
            errorRef.current?.(
              "Saved calculation could not be loaded."
            );
          }
          return;
        }

        if (!("toolSlug" in payload) || payload.toolSlug !== toolSlug) {
          if (isActive) {
            errorRef.current?.(
              "This saved calculation belongs to a different tool."
            );
          }
          return;
        }

        if (isActive) {
          restoreRef.current(payload);
        }
      } catch {
        if (isActive) {
          errorRef.current?.("Saved calculation could not be loaded.");
        }
      }
    }

    void restoreSavedCalculation();

    return () => {
      isActive = false;
    };
  }, [pathname, router, searchParams, toolSlug]);
}
