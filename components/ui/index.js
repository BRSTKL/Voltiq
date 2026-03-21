import Link from "next/link";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export { default as ExportButton } from "./ExportButton";

const badgeColorClasses = {
  green: "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]",
  blue: "bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]",
  amber: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]",
  purple: "bg-[var(--badge-purple-bg)] text-[var(--badge-purple-text)]",
  teal: "bg-[var(--badge-teal-bg)] text-[var(--badge-teal-text)]",
};

export function PanelCard({ children, className = "" }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 text-[var(--color-text)] [border:var(--border-default)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MetricCard({ label, value, unit, accent = false }) {
  const cardClasses = accent
    ? "bg-[var(--color-brand)] text-[var(--color-inverse)]"
    : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] [border:var(--border-default)]";

  const metaClasses = accent ? "text-white/75" : "text-[var(--color-text-muted)]";

  return (
    <div className={cn("rounded-[var(--radius-lg)] p-5", cardClasses)}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", metaClasses)}>
        {label}
      </p>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className={cn("pb-1 text-sm font-medium", metaClasses)}>{unit}</span> : null}
      </div>
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

export function Badge({ children, color = "green" }) {
  const colorClasses = badgeColorClasses[color] ?? badgeColorClasses.green;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] [border:var(--border-default)]",
        colorClasses
      )}
    >
      {children}
    </span>
  );
}

export function ActionButton({
  onClick,
  children,
  loading = false,
  variant = "primary",
  type = "button",
}) {
  const isPrimary = variant === "primary";
  const buttonClasses = isPrimary
    ? "bg-[var(--color-brand)] text-[var(--color-inverse)] hover:bg-[var(--color-brand-dark)]"
    : "bg-transparent text-[var(--color-text)] [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]";
  const spinnerClasses = isPrimary
    ? "border-white/25 border-t-white"
    : "border-[var(--color-spinner-track)] border-t-[var(--color-text)]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-70",
        buttonClasses
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className={cn("h-4 w-4 animate-spin rounded-full border-2", spinnerClasses)}
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function SliderField({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  displayValue,
}) {
  return (
    <label className="flex w-full flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="h-2 w-full flex-1 cursor-pointer accent-[var(--color-brand)]"
        />
        <span className="min-w-[3.5rem] text-right text-sm font-semibold tabular-nums text-[var(--color-text)]">
          {displayValue ?? value}
        </span>
      </div>
    </label>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 10h11" />
      <path d="m10.5 4.75 5.25 5.25-5.25 5.25" />
    </svg>
  );
}

export function ProjectReportCta({
  variant = "row",
  title = "Add to project report",
  description = "Combine this result with the rest of your Voltiq workflow in one professional PDF report.",
  className = "",
}) {
  if (variant === "card") {
    return (
      <Link
        href="/report"
        className={cn(
          "rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4 transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-brand-light)] text-[var(--color-brand)]">
            <ArrowIcon />
          </span>
          <ArrowIcon />
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
      </Link>
    );
  }

  return (
    <div className={className}>
      <SectionLabel>Project report</SectionLabel>
      <Link
        href="/report"
        className="mt-3 inline-flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-brand-light)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-dark)] transition-colors duration-200 [border:1px_solid_rgba(29,158,117,0.22)] hover:bg-[color:color-mix(in_srgb,var(--color-brand-light)_72%,white)]"
      >
        <span>{title}</span>
        <ArrowIcon />
      </Link>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}
