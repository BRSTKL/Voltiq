import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:pointer-events-none disabled:opacity-60",
          variant === "default" &&
            "bg-[var(--color-brand)] text-[var(--color-inverse)] hover:bg-[var(--color-brand-dark)]",
          variant === "outline" &&
            "bg-transparent text-[var(--color-text)] [border:var(--border-default)] hover:bg-[var(--color-overlay-subtle)]",
          variant === "ghost" && "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-overlay-subtle)]",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
