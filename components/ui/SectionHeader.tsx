import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  const centered = align === "center";

  return (
    <div className={cn("flex flex-col gap-3", centered && "items-center text-center", className)}>
      {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
      <h2 className="font-display text-[30px] leading-[1.02] tracking-[-0.03em] text-[#F8F8F2] sm:text-[36px]">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-[560px] text-sm leading-6 text-[var(--color-text-muted)] sm:text-base sm:leading-7",
            centered && "mx-auto"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
