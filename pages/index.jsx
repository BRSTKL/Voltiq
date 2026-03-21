import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  Battery100Icon,
  BeakerIcon,
  BoltIcon,
  CheckIcon,
  CurrencyDollarIcon,
  CubeTransparentIcon,
  GlobeEuropeAfricaIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { Badge, PanelCard, SectionLabel } from "../components/ui";

const toolColorClasses = {
  "#E1F5EE": "bg-[#E1F5EE] dark:bg-[rgba(29,158,117,0.16)]",
  "#E6F1FB": "bg-[#E6F1FB] dark:bg-[rgba(24,95,165,0.18)]",
  "#FAEEDA": "bg-[#FAEEDA] dark:bg-[rgba(133,79,11,0.18)]",
  "#EEEDFE": "bg-[#EEEDFE] dark:bg-[rgba(83,74,183,0.18)]",
  "#EAF3DE": "bg-[#EAF3DE] dark:bg-[rgba(59,109,17,0.16)]",
};

const toolIconClasses = {
  "#1D9E75": "text-[#1D9E75]",
  "#185FA5": "text-[#185FA5]",
  "#854F0B": "text-[#854F0B]",
  "#534AB7": "text-[#534AB7]",
  "#0F6E56": "text-[#0F6E56]",
  "#3B6D11": "text-[#3B6D11]",
};

const toolData = [
  {
    name: "Site Assessment",
    desc: "Solar project site suitability score with solar resource, grid access, terrain and regulatory risk screening.",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    apis: "Open-Meteo + Gemini",
    href: "/tools/site-assessment",
    Icon: MapPinIcon,
  },
  {
    name: "Solar Yield Estimator",
    desc: "Location-based annual yield with real climate data and system optimization",
    color: "#E1F5EE",
    iconColor: "#1D9E75",
    apis: "Open-Meteo archive",
    href: "/tools/solar",
    featured: true,
    Icon: SunIcon,
  },
  {
    name: "Battery Storage Sizer",
    desc: "LFP/NMC/Lead-acid comparison with DoD analysis and optimal capacity",
    color: "#E6F1FB",
    iconColor: "#185FA5",
    apis: "Sizing engine",
    href: "/tools/battery",
    Icon: Battery100Icon,
  },
  {
    name: "LCOE Comparator",
    desc: "Compare levelized cost of energy for solar, wind, gas and nuclear with CAPEX breakdown and carbon pricing impact.",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    apis: "Pure calculation + Gemini",
    href: "/tools/lcoe",
    Icon: CurrencyDollarIcon,
  },
  {
    name: "Solar ROI Calculator",
    desc: "25-year cumulative return, payback period and electricity price escalation",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    apis: "Pure calculation",
    href: "/tools/roi",
    Icon: CurrencyDollarIcon,
  },
  {
    name: "Shading Loss Analyzer",
    desc: "Horizon diagram, sun path simulation and inverter-aware shading loss",
    color: "#EEEDFE",
    iconColor: "#534AB7",
    apis: "Simulation engine",
    href: "/tools/shading",
    Icon: CubeTransparentIcon,
  },
  {
    name: "Wind Energy Estimator",
    desc: "Weibull distribution, hub height scaling and turbine power curve yield",
    color: "#E1F5EE",
    iconColor: "#0F6E56",
    apis: "Open-Meteo archive",
    href: "/tools/wind",
    Icon: PaperAirplaneIcon,
  },
  {
    name: "Green H2 Calculator",
    desc: "Green hydrogen cost per kg based on electrolyzer capacity and electricity price",
    color: "#E1F5EE",
    iconColor: "#0F6E56",
    apis: "Pure calculation + Gemini",
    href: "/tools/hydrogen",
    Icon: BeakerIcon,
  },
  {
    name: "Carbon Intensity Tracker",
    desc: "Real-time grid carbon intensity by country with energy mix, CO2 footprint and country comparison",
    color: "#EAF3DE",
    iconColor: "#3B6D11",
    apis: "Electricity Maps API + Gemini",
    href: "/tools/carbon",
    Icon: GlobeEuropeAfricaIcon,
  },
  {
    name: "Cable Sizing Calculator",
    desc: "DC and AC cable cross-section with voltage-drop limits, ampacity derating and annual energy loss",
    color: "#FAEEDA",
    iconColor: "#854F0B",
    apis: "Pure calculation + Gemini",
    href: "/tools/cable",
    Icon: BoltIcon,
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    cadence: "/mo",
    buttonLabel: "Get started",
    buttonHref: "/tools",
    buttonVariant: "outline",
    features: [
      { label: "3 tools", included: true },
      { label: "20 calc/day", included: true },
      { label: "PDF export", included: false },
      { label: "Engineering summaries", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo",
    buttonLabel: "Start 14-day free trial",
    buttonHref: "/tools",
    buttonVariant: "primary",
    featured: true,
    features: [
      { label: "All 10 tools", included: true },
      { label: "Unlimited calc", included: true },
      { label: "PDF + Excel export", included: true },
      { label: "Engineering summaries", included: true },
      { label: "Priority support", included: true },
    ],
  },
  {
    name: "Enterprise",
    price: "$99",
    cadence: "/mo",
    buttonLabel: "Contact sales",
    buttonHref: "/contact",
    buttonVariant: "outline",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "REST API access", included: true },
      { label: "5 team members", included: true },
      { label: "White-label export", included: true },
      { label: "Dedicated support", included: true },
    ],
  },
];

const stats = ["10 Engineering tools", "Free APIs", "Project-ready outputs"];

const cn = (...classes) => classes.filter(Boolean).join(" ");

const buttonClasses = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-[var(--color-inverse)] transition-colors duration-200 hover:bg-[var(--color-brand-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)]",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition-colors duration-200 [border:var(--border-default)] hover:[border:var(--border-emphasis)] hover:bg-[var(--color-overlay-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg)]",
};

function ArrowLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{children}</span>
      <ArrowRightIcon className="h-4 w-4" />
    </span>
  );
}

function ToolCard({ tool }) {
  const Icon = tool.Icon;
  const isLive = !tool.comingSoon;

  return (
    <PanelCard
      className={cn(
        "flex h-full flex-col gap-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]",
        tool.featured ? "border border-[var(--color-brand)]" : ""
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
            toolColorClasses[tool.color]
          )}
        >
          <Icon className={cn("h-5 w-5", toolIconClasses[tool.iconColor])} />
        </div>
        {tool.comingSoon ? <Badge color="purple">Coming soon</Badge> : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-[14px] font-medium text-[var(--color-text)]">{tool.name}</h3>
        <p className="truncate text-sm leading-6 text-[var(--color-text-muted)]" title={tool.desc}>
          {tool.desc}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-black/0 pt-4 [border-top:var(--border-default)]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {tool.apis}
        </span>
        {isLive ? (
          <Link
            href={tool.href}
            className="text-sm font-semibold text-[var(--color-brand)] transition-colors duration-200 hover:text-[var(--color-brand-dark)]"
          >
            <ArrowLabel>Try</ArrowLabel>
          </Link>
        ) : (
          <span className="text-sm font-semibold text-[var(--color-text-muted)]">
            <ArrowLabel>Try</ArrowLabel>
          </span>
        )}
      </div>
    </PanelCard>
  );
}

function FeatureRow({ label, included }) {
  return (
    <li className="flex items-center gap-3 text-sm text-[var(--color-text)]">
      <span
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          included
            ? "bg-[var(--color-brand-light)] text-[var(--color-brand)]"
            : "bg-[var(--color-overlay-subtle)] text-[var(--color-text-muted)]"
        )}
      >
        {included ? <CheckIcon className="h-3.5 w-3.5 stroke-[2.5]" /> : <span>-</span>}
      </span>
      <span>{label}</span>
    </li>
  );
}

function PricingCard({ plan }) {
  return (
    <PanelCard
      className={cn(
        "flex h-full flex-col gap-6",
        plan.featured ? "border border-[var(--color-brand)] shadow-[0_20px_50px_rgba(29,158,117,0.12)]" : ""
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-medium text-[var(--color-text)]">{plan.name}</p>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-[34px] font-medium leading-none tracking-[-0.03em] text-[var(--color-text)]">
                {plan.price}
              </span>
              <span className="pb-1 text-sm text-[var(--color-text-muted)]">{plan.cadence}</span>
            </div>
          </div>
          {plan.featured ? <Badge color="green">Most popular</Badge> : null}
        </div>
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <FeatureRow key={feature.label} label={feature.label} included={feature.included} />
          ))}
        </ul>
      </div>

      <Link href={plan.buttonHref} className={cn("mt-auto w-full", buttonClasses[plan.buttonVariant])}>
        {plan.buttonLabel}
      </Link>
    </PanelCard>
  );
}

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Voltiq | Renewable energy calculations in seconds</title>
        <meta
          name="description"
          content="From solar feasibility to wind farm analysis - every calculation your project needs, in one place."
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#E1F5EE" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#09120F" />
      </Head>

      <main className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] overflow-hidden"
        >
          <div className="absolute left-[-8rem] top-12 h-72 w-72 rounded-full bg-[rgba(29,158,117,0.16)] blur-3xl" />
          <div className="absolute right-[-5rem] top-24 h-64 w-64 rounded-full bg-[rgba(24,95,165,0.12)] blur-3xl" />
        </div>

        <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 sm:pb-16 sm:pt-24">
          <div className="max-w-3xl">
            <Badge color="green">Built for energy engineers</Badge>
            <h1 className="mt-6 text-[34px] font-medium leading-[1.02] tracking-[-0.03em] text-[var(--color-text)] sm:text-[38px]">
              Renewable energy calculations
              <br />
              in <span className="text-[var(--color-brand)]">seconds</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
              From solar feasibility to wind farm analysis - every calculation your project needs,
              in one place.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/tools" className={buttonClasses.primary}>
                <ArrowLabel>Start free</ArrowLabel>
              </Link>
              <Link href="/tools" className={buttonClasses.outline}>
                See all tools
              </Link>
            </div>
          </div>

          <div className="mt-12 border-t border-black/0 pt-6 [border-top:var(--border-default)]">
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat}
                  className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-4 py-4 text-sm font-medium text-[var(--color-text)] shadow-[0_12px_30px_rgba(15,23,42,0.04)] [border:var(--border-default)]"
                >
                  {stat}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
          <SectionLabel>Tool suite</SectionLabel>
          <div className="mt-3 max-w-2xl">
            <h2 className="text-3xl font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[34px]">
              A tool for every project phase
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-5">
            {toolData.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 sm:py-16">
          <SectionLabel>Pricing</SectionLabel>
          <div className="mt-3 max-w-2xl">
            <h2 className="text-3xl font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[34px]">
              Choose your plan
            </h2>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16 pt-6 sm:pb-24 sm:pt-10">
          <div className="rounded-[28px] bg-[var(--color-brand-light)] px-6 py-10 text-center shadow-[0_18px_40px_rgba(15,23,42,0.05)] [border:var(--border-default)] sm:px-10">
            <h2 className="text-[30px] font-medium tracking-[-0.03em] text-[var(--color-text)] sm:text-[34px]">
              Start calculating in 30 seconds
            </h2>
            <p className="mt-3 text-base text-[var(--color-text-muted)]">
              No credit card required. Free plan available.
            </p>
            <div className="mt-7 flex justify-center">
              <Link href="/tools/solar" className={buttonClasses.primary}>
                <ArrowLabel>Try Solar Estimator</ArrowLabel>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
