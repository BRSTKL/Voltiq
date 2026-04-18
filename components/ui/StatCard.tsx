import * as React from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaDir?: "up" | "down" | "neutral";
  className?: string;
}

const deltaStyles = {
  up: {
    icon: ChevronUp,
    className: "text-status-success",
  },
  down: {
    icon: ChevronDown,
    className: "text-status-danger",
  },
  neutral: {
    icon: ChevronRight,
    className: "text-volt-subtle",
  },
} as const;

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaDir = "neutral",
  className,
}: StatCardProps) {
  const deltaStyle = deltaStyles[deltaDir];
  const DeltaIcon = deltaStyle.icon;

  return (
    <Card className={cn("card-surface shadow-card", className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="section-label">{label}</p>
        <div className="flex items-end gap-2">
          <span className="data-value font-mono text-[28px] leading-none">{value}</span>
          {unit ? (
            <span className="pb-0.5 text-sm text-[var(--color-text-muted)]">{unit}</span>
          ) : null}
        </div>
        {delta ? (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium tabular-nums",
              deltaStyle.className
            )}
          >
            <DeltaIcon aria-hidden="true" className="size-3.5" />
            <span>{delta}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
