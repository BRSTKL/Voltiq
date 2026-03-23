import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded bg-[var(--color-surface)] text-[var(--color-brand)] accent-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] [border:var(--border-default)]",
          className
        )}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";
