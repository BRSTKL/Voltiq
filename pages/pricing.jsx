import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  X,
  ChevronDown,
  Sparkles,
  FileText,
  Brain,
  Sun,
  Wind,
  Battery,
  TrendingUp,
  Leaf,
  BarChart2,
  Cpu,
  Zap,
  MapPin,
} from "lucide-react";
import { Badge } from "../components/ui";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "/ month",
    subtitle: "For individual engineers exploring the tools.",
    ctaLabel: "Start free",
    ctaHref: "/tools",
    ctaVariant: "outline",
    features: [
      { label: "All 14 engineering tools — unlimited calculations", included: true },
      { label: "Real climate data via Open-Meteo API", included: true },
      { label: "Solar, wind, storage, financial & ESG tools", included: true },
      { label: "Browser-based — no account required", included: true },
      { label: "Export results as PDF (basic)", included: true },
      { label: "AI-powered engineering analysis (Gemini)", included: false },
      { label: "Multi-tool project report PDF", included: false },
      { label: "Executive summary generation", included: false },
      { label: "Team workspace", included: false },
      { label: "Priority support", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    subtitle: "For engineers delivering client projects.",
    ctaLabel: "Start Pro free for 14 days",
    ctaHref: "/tools",
    ctaVariant: "primary",
    badge: "Most popular",
    features: [
      { label: "Everything in Free", included: true },
      { label: "Gemini AI analysis on every tool", included: true },
      { label: "Multi-tool project report PDF", included: true },
      { label: "Executive summary generation", included: true },
      { label: "Unlimited PDF exports (full quality)", included: true },
      { label: "Project save & restore (JSON export/import)", included: true },
      { label: "Priority email support", included: true },
      { label: "Team workspace", included: false },
      { label: "White-label PDF reports", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    subtitle: "For teams and consulting firms.",
    ctaLabel: "Contact us",
    ctaHref: "mailto:hello@voltiq.io",
    ctaVariant: "outline",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "Team workspace — shared projects", included: true },
      { label: "White-label PDF reports (your logo, your branding)", included: true },
      { label: "API access for tool integrations", included: true },
      { label: "SSO / SAML authentication", included: true },
      { label: "Dedicated onboarding & training", included: true },
      { label: "SLA-backed uptime guarantee", included: true },
      { label: "Custom tool development", included: true },
    ],
  },
];

const TOOLS = [
  { name: "Site Assessment", category: "Site & Resource", icon: MapPin },
  { name: "Solar Yield Estimator", category: "Site & Resource", icon: Sun },
  { name: "Wind Energy Estimator", category: "Site & Resource", icon: Wind },
  { name: "Carbon Intensity Tracker", category: "Site & Resource", icon: Leaf },
  { name: "Shading Loss Analyzer", category: "Technical Design", icon: Sun },
  { name: "PV Loss Breakdown", category: "Technical Design", icon: BarChart2 },
  { name: "Inverter Sizing", category: "Technical Design", icon: Cpu },
  { name: "Cable Sizing Calculator", category: "Technical Design", icon: Zap },
  { name: "Battery Storage Sizer", category: "Storage", icon: Battery },
  { name: "Storage ROI Calculator", category: "Storage", icon: TrendingUp },
  { name: "Solar ROI Calculator", category: "Financial & ESG", icon: TrendingUp },
  { name: "LCOE Comparator", category: "Financial & ESG", icon: BarChart2 },
  { name: "Scope 2 Calculator", category: "Financial & ESG", icon: Leaf },
  { name: "Green Hydrogen Calculator", category: "Financial & ESG", icon: Zap },
];

const PRO_FEATURES = [
  {
    title: "AI engineering analysis",
    body: "Every tool generates a Gemini-powered engineering interpretation — voltage safety notes, improvement priorities, market context. Not a generic summary. A technical review.",
    icon: Sparkles,
  },
  {
    title: "Multi-tool project report",
    body: "Combine results from all 14 tools into a single professional PDF. Structured by project phase — site, design, storage, financial, ESG. Ready to send to a client.",
    icon: FileText,
  },
  {
    title: "AI executive summary",
    body: "Gemini reads all your tool results and writes a project-wide engineering narrative. Use it as the cover page of your report or as a standalone client briefing.",
    icon: Brain,
  },
];

const FAQS = [
  {
    q: "Is the free tier really free forever?",
    a: "Yes. All 14 engineering tools, unlimited calculations, and real climate data are free with no time limit and no account required. We don't ask for a credit card.",
  },
  {
    q: "What is the AI analysis feature?",
    a: "Each tool can call Google Gemini to generate a technical engineering review of your results — voltage compliance notes, performance ratio interpretation, LCOS market comparison, and so on. This requires a Pro subscription.",
  },
  {
    q: "What does the project report PDF include?",
    a: "The report PDF combines the results from every tool you've run — site assessment, yield, loss chain, inverter check, cable sizing, battery sizing, ROI, LCOE, and ESG — into a single structured document organized by project phase. It includes an AI-written executive summary and a methodology appendix.",
  },
  {
    q: "Can I use my own Gemini API key?",
    a: "On the Free tier, you can supply your own NEXT_PUBLIC_GEMINI_API_KEY environment variable to unlock AI features locally. Pro includes a managed key with no setup required.",
  },
  {
    q: "Do you store my calculation data?",
    a: "No. All calculations run in your browser. Results are stored in your browser's localStorage only — nothing is sent to our servers unless you explicitly generate a report or use the AI features.",
  },
  {
    q: "What is your refund policy?",
    a: "We offer a 14-day free trial on Pro. If you upgrade and decide it's not for you within 14 days, contact us for a full refund — no questions asked.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings at any time. You keep Pro access until the end of your billing period.",
  },
];

function ButtonLink({ href, children, variant = "primary", external = false }) {
  const classes =
    variant === "primary"
      ? "inline-flex w-full items-center justify-center rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
      : "inline-flex w-full items-center justify-center rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-gray-600 hover:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950";

  if (external) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

function PricingCard({ tier }) {
  const isPro = tier.name === "Pro";

  return (
    <div
      className={`relative rounded-2xl border p-6 ${
        isPro
          ? "border-green-500/40 ring-1 ring-green-500/20 bg-gray-900"
          : "border-gray-800 bg-gray-900"
      } flex flex-col gap-5`}
    >
      {isPro ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
            {tier.badge}
          </span>
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-green-400">
          {tier.name}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{tier.price}</span>
          {tier.period ? <span className="text-sm text-gray-400">{tier.period}</span> : null}
        </div>
        <p className="mt-1 text-sm text-gray-400">{tier.subtitle}</p>
      </div>

      <ButtonLink
        href={tier.ctaHref}
        variant={tier.ctaVariant}
        external={tier.ctaHref.startsWith("mailto:")}
      >
        {tier.ctaLabel}
      </ButtonLink>

      <div className="border-t border-gray-800" />

      <ul className="space-y-2.5">
        {tier.features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5 text-sm">
            {feature.included ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
            )}
            <span className={feature.included ? "text-gray-300" : "text-gray-600"}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;

        return (
          <div
            key={tool.name}
            className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            <div>
              <p className="text-sm font-medium text-white">{tool.name}</p>
              <p className="text-xs text-gray-500">{tool.category}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FAQAccordion({ open, setOpen }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 px-6">
      {FAQS.map((faq, index) => (
        <div
          key={faq.q}
          className={index === FAQS.length - 1 ? "" : "border-b border-gray-800"}
        >
          <button
            type="button"
            onClick={() => setOpen(open === index ? null : index)}
            className="flex w-full items-center justify-between gap-4 py-4 text-left"
            aria-expanded={open === index}
          >
            <span className="text-sm font-medium text-white">{faq.q}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                open === index ? "rotate-180" : ""
              }`}
            />
          </button>
          {open === index ? (
            <p className="pb-4 text-sm leading-relaxed text-gray-400">{faq.a}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const [open, setOpen] = useState(0);

  return (
    <>
      <Head>
        <title>Pricing — Voltiq</title>
        <meta
          name="description"
          content="Start free with all 14 engineering tools. Upgrade to Pro for AI analysis, PDF reports, and executive summaries."
        />
      </Head>

      <div className="bg-gray-950 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 space-y-16 sm:space-y-20">
          <section className="mb-12 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="green">Engineering-grade tools</Badge>
              <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-gray-300">
                No credit card required
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Simple, transparent pricing
            </h1>
            <p className="max-w-lg text-sm text-gray-400">
              Start free with the full tool suite. Upgrade when you need AI-powered
              analysis, PDF reports, and team collaboration.
            </p>
          </section>

          <section className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
                Plans
              </p>
              <h2 className="text-xl font-semibold text-white">Choose the right tier</h2>
              <p className="text-sm text-gray-400">
                Keep engineering calculations free. Upgrade when the workflow needs
                client-ready deliverables and managed AI.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TIERS.map((tier) => (
                <PricingCard key={tier.name} tier={tier} />
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
                Included in free
              </p>
              <h2 className="text-xl font-semibold text-white">Every tool. Free. Forever.</h2>
              <p className="text-sm text-gray-400">
                No account needed. All 14 engineering tools run entirely in your browser
                using real climate data.
              </p>
            </div>
            <ToolGrid />
          </section>

          <section className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
                Pro spotlight
              </p>
              <h2 className="text-xl font-semibold text-white">What Pro unlocks</h2>
              <p className="text-sm text-gray-400">
                The tools are free. Pro adds the layer that turns calculations into
                deliverables.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PRO_FEATURES.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-500/30 bg-green-500/10">
                      <Icon className="h-4 w-4 text-green-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-gray-400">{feature.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
                FAQ
              </p>
              <h2 className="text-xl font-semibold text-white">Common questions</h2>
            </div>
            <FAQAccordion open={open} setOpen={setOpen} />
          </section>

          <section>
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-8 py-10 text-center space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
                Get started today
              </p>
              <h2 className="text-2xl font-bold text-white">
                Run your first calculation in 30 seconds
              </h2>
              <p className="mx-auto max-w-md text-sm text-gray-400">
                No account. No credit card. Open a tool, enter your parameters, and get
                engineering-grade results instantly.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                >
                  Open tools →
                </Link>
                <Link
                  href="/report"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-700 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:border-gray-600 hover:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                >
                  Generate report
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
