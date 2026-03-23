import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "outline"
          ? "bg-transparent text-[var(--color-text)] [border:var(--border-default)]"
          : "border-transparent bg-[var(--color-brand)] text-[var(--color-inverse)]",
        className
      )}
      {...props}
    />
  );
}
