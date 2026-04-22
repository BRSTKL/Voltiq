import Link from "next/link";
import { BarChart3, Download, Shield, Zap } from "lucide-react";

export const metadata = {
  title: "Documentation | Voltiq",
  description:
    "Learn how to use Voltiq's renewable energy engineering tools and plan limits.",
};

const gettingStartedSteps = [
  {
    step: "1",
    title: "Create an account",
    description:
      "Sign up for free with Google or email. No credit card required.",
  },
  {
    step: "2",
    title: "Choose a tool",
    description:
      "Browse our 15 engineering calculators and select the one you need.",
  },
  {
    step: "3",
    title: "Enter your parameters",
    description:
      "Input your project-specific data - system capacity, location, costs, and more.",
  },
  {
    step: "4",
    title: "Get results",
    description:
      "View detailed calculations, charts, and AI-powered analysis. Save or export as PDF.",
  },
];

const toolCategories = [
  {
    category: "Solar & PV",
    icon: Zap,
    tools: [
      {
        name: "Solar Yield Estimator",
        slug: "solar",
        description:
          "Estimate annual and monthly solar energy production based on system size, location, and panel specs.",
      },
      {
        name: "PV Loss Breakdown",
        slug: "pv-loss",
        description:
          "Analyze losses from temperature, shading, soiling, wiring, and inverter inefficiency.",
      },
      {
        name: "Shading Loss Analyzer",
        slug: "shading",
        description: "Calculate energy losses from horizon shading and nearby obstacles.",
      },
      {
        name: "Inverter Sizing",
        slug: "inverter-sizing",
        description:
          "Determine optimal inverter capacity for your PV array with DC/AC ratio analysis.",
      },
      {
        name: "Cable Sizing Calculator",
        slug: "cable",
        description: "Calculate minimum cable cross-section for voltage drop and current capacity.",
      },
    ],
  },
  {
    category: "Financial Analysis",
    icon: BarChart3,
    tools: [
      {
        name: "Solar ROI Calculator",
        slug: "roi",
        description:
          "Calculate return on investment, payback period, and NPV for solar projects.",
      },
      {
        name: "Storage ROI Calculator",
        slug: "storage-roi",
        description: "Evaluate the financial viability of battery storage systems.",
      },
      {
        name: "LCOE Comparator",
        slug: "lcoe",
        description:
          "Compare Levelized Cost of Energy across different generation technologies.",
      },
    ],
  },
  {
    category: "Site & Environment",
    icon: Shield,
    tools: [
      {
        name: "Site Assessment",
        slug: "site-assessment",
        description:
          "Comprehensive site evaluation including solar resource, terrain, and grid proximity.",
      },
      {
        name: "Wind Energy Estimator",
        slug: "wind",
        description:
          "Estimate wind energy production using Weibull distribution and turbine specs.",
      },
      {
        name: "Land Use & Capacity Estimator",
        slug: "land-use-capacity",
        description:
          "Calculate land requirements and generation capacity for solar or wind farms.",
      },
      {
        name: "Battery Storage Sizer",
        slug: "battery",
        description: "Size battery systems based on load profiles and backup requirements.",
      },
    ],
  },
  {
    category: "Carbon & Sustainability",
    icon: Download,
    tools: [
      {
        name: "Carbon Intensity Tracker",
        slug: "carbon",
        description:
          "Track and compare carbon intensity across energy sources and regions.",
      },
      {
        name: "Scope 2 Calculator",
        slug: "scope2",
        description:
          "Calculate Scope 2 greenhouse gas emissions from purchased electricity.",
      },
      {
        name: "Green Hydrogen Calculator",
        slug: "hydrogen",
        description:
          "Estimate green hydrogen production costs and electrolyzer sizing.",
      },
    ],
  },
];

const planFeatures = [
  {
    plan: "Free",
    features: [
      "3 tools: Solar Yield, Battery Storage, Solar ROI",
      "20 calculations per day",
      "Save calculations to dashboard",
      "PDF export",
    ],
  },
  {
    plan: "Pro",
    features: [
      "All 15 engineering tools",
      "Unlimited calculations",
      "Save & restore calculations",
      "PDF report generation",
      "AI-powered analysis",
      "Priority support",
    ],
  },
  {
    plan: "Enterprise",
    features: [
      "Everything in Pro",
      "API access for integrations",
      "Custom branding on reports",
      "Dedicated support",
      "Team management",
    ],
  },
];

const faqs = [
  {
    q: "How accurate are the calculations?",
    a: "Our tools use industry-standard formulas and publicly available climate data. Results are suitable for preliminary analysis and feasibility studies. Always validate with site-specific measurements for final engineering decisions.",
  },
  {
    q: "Can I export my results?",
    a: "Yes. All tools support PDF export. Pro and Enterprise users can also generate comprehensive multi-tool reports and save calculations for later reference.",
  },
  {
    q: "What happens when I reach my daily limit?",
    a: "Free plan users are limited to 20 calculations per day. Once you reach the limit, you can upgrade to Pro for unlimited access or wait until the next day.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, you can cancel anytime from your Stripe billing portal. You will retain access until the end of your current billing period.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit (TLS) and at rest. We use Stripe for payment processing and never store your card details. See our Privacy Policy for details.",
  },
];

export default function DocsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Documentation
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
        Everything you need to know to get started with Voltiq and make the most of
        our renewable energy calculation tools.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Getting Started</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {gettingStartedSteps.map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand)] text-sm font-bold text-white">
                {item.step}
              </div>
              <h3 className="mt-3 font-semibold text-[var(--color-text)]">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Tools Reference</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Voltiq includes 15 engineering calculators organized into four categories.
        </p>
        <div className="mt-6 space-y-8">
          {toolCategories.map((category) => (
            <div key={category.category}>
              <div className="flex items-center gap-2">
                <category.icon className="h-5 w-5 text-[var(--color-brand)]" />
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  {category.category}
                </h3>
              </div>
              <div className="mt-3 space-y-3">
                {category.tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-brand)] hover:shadow-sm"
                  >
                    <h4 className="font-medium text-[var(--color-text)]">{tool.name}</h4>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{tool.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Plans & Limits</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {planFeatures.map((plan) => (
            <div
              key={plan.plan}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="font-semibold text-[var(--color-text)]">{plan.plan}</h3>
              <ul className="mt-3 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-[var(--color-muted)]"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">FAQ</h2>
        <div className="mt-6 space-y-5">
          {faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h3 className="font-medium text-[var(--color-text)]">{faq.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center sm:p-8">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">
          Ready to get started?
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Create a free account and start running calculations in seconds.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/tools"
            className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Try for free
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
