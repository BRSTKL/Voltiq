import Head from "next/head";
import Link from "next/link";
import StripePricingPage from "../components/StripePricingPage";
import { Badge } from "../components/ui";
import { SectionHeader } from "../components/ui/SectionHeader";
import { getToolDefinitions } from "../lib/toolRegistry";

const categoryColorMap = {
  Solar: "#F59E0B",
  Wind: "#3B82F6",
  Storage: "#8B5CF6",
  Financial: "#10B981",
  Sustainability: "#06B6D4",
  Electrical: "#EF4444",
  Hydrogen: "#EC4899",
  default: "#6B7280",
};

const heroStats = [
  { accent: "15", label: "ara\u00E7" },
  { accent: "EP\u0130A\u015E", label: "verisi" },
  { accent: "\u00DCcretsiz", label: "ba\u015Fla" },
];

const socialProofLogos = [
  "ENERJ\u0130 A.\u015E.",
  "TRADING LTD.",
  "RENEWABLES CO.",
  "GRID CORP.",
];

const platformFeatures = {
  market: [
    "Saatlik PTF ge\u00E7mi\u015Fi (2019\u2013bug\u00FCn)",
    "24 saatlik fiyat tahmini",
    "Peak/off-peak \u0131s\u0131 haritas\u0131",
    "G\u00FCnl\u00FCk \u00F6r\u00FCnt\u00FC analizi",
  ],
  engineering: [
    "Solar & r\u00FCzgar verim tahmini",
    "LCOE & ROI hesaplay\u0131c\u0131lar\u0131",
    "PDF & Excel d\u0131\u015Fa aktarma",
    "AI m\u00FChendislik \u00F6zetleri",
  ],
};

const howItWorksSteps = [
  {
    number: "01",
    icon: "\uD83D\uDCE1",
    title: "Ba\u011Flan",
    description:
      "EP\u0130A\u015E \u015Eeffafl\u0131k Platformu'ndan PTF verisini saatlik olarak \u00E7ekiyoruz.",
  },
  {
    number: "02",
    icon: "\uD83D\uDCCA",
    title: "Analiz Et",
    description:
      "5+ y\u0131ll\u0131k fiyat ge\u00E7mi\u015Fini, \u00F6r\u00FCnt\u00FCleri ve anomalileri ke\u015Ffedin.",
  },
  {
    number: "03",
    icon: "\uD83C\uDFAF",
    title: "Tahmin Et",
    description: "G\u00FCven aral\u0131kl\u0131 24 saatlik PTF tahminleri al\u0131n.",
  },
];

const toolPresentationBySlug = {
  "site-assessment": {
    category: "Solar",
    description:
      "Solar proje sahalar\u0131n\u0131 kaynak, \u015Febeke, topo\u011Frafya ve reg\u00FClasyon a\u00E7\u0131s\u0131ndan taray\u0131n.",
    isNew: true,
  },
  solar: {
    category: "Solar",
    description:
      "Ger\u00E7ek iklim verisiyle \u00FCretim tahmini, spesifik yield ve sistem optimizasyonu.",
  },
  wind: {
    category: "Wind",
    description:
      "Hub y\u00FCksekli\u011Fi, Weibull da\u011F\u0131l\u0131m\u0131 ve t\u00FCrbin e\u011Frileriyle r\u00FCzgar \u00FCretim tahmini.",
  },
  shading: {
    category: "Solar",
    description:
      "G\u00F6lgeleme, horizon profili ve inverter davran\u0131\u015F\u0131yla kay\u0131p etkisini sim\u00FCle edin.",
  },
  "pv-loss": {
    category: "Solar",
    description:
      "Irradiance'tan net AC \u00E7\u0131k\u0131\u015F\u0131na kadar PV kay\u0131p zincirini ad\u0131m ad\u0131m g\u00F6r\u00FCn.",
    isNew: true,
  },
  "inverter-sizing": {
    category: "Solar",
    description:
      "String voltaj penceresi, DC/AC oran\u0131 ve clipping riskini tasar\u0131ma g\u00F6re do\u011Frulay\u0131n.",
    isNew: true,
  },
  cable: {
    category: "Electrical",
    description:
      "IEC tabanl\u0131 DC/AC kablo boyutland\u0131rma, voltage drop ve ampacity kontrol\u00FC.",
    isNew: true,
  },
  battery: {
    category: "Storage",
    description:
      "LFP, NMC ve lead-acid se\u00E7enekleriyle uygun batarya kapasitesini hesaplay\u0131n.",
  },
  "storage-roi": {
    category: "Storage",
    description:
      "Peak shaving, arbitrage ve yedekleme senaryolar\u0131yla depolama yat\u0131r\u0131m\u0131n\u0131 modelleyin.",
    isNew: true,
  },
  roi: {
    category: "Financial",
    description:
      "25 y\u0131ll\u0131k nakit ak\u0131\u015F\u0131, geri \u00F6deme s\u00FCresi ve fiyat art\u0131\u015F etkisini g\u00F6r\u00FCn.",
  },
  lcoe: {
    category: "Financial",
    description:
      "Solar, r\u00FCzgar ve di\u011Fer teknolojiler i\u00E7in LCOE ve hassasiyet kar\u015F\u0131la\u015Ft\u0131rmas\u0131 yap\u0131n.",
    isNew: true,
  },
  carbon: {
    category: "Sustainability",
    description:
      "\u00DClke bazl\u0131 grid karbon yo\u011Funlu\u011Fu, enerji kar\u0131\u015F\u0131m\u0131 ve footprint kar\u015F\u0131la\u015Ft\u0131rmas\u0131.",
    isNew: true,
  },
  "land-use-capacity": {
    category: "Solar",
    description:
      "Arazi alan\u0131ndan kurulu g\u00FC\u00E7, panel say\u0131s\u0131 ve inverter \u00F6n-boyutland\u0131rmas\u0131n\u0131 \u00E7\u0131kar\u0131n.",
    isNew: true,
  },
  scope2: {
    category: "Sustainability",
    description:
      "Location-based ve market-based Scope 2 emisyonlar\u0131n\u0131 h\u0131zl\u0131ca raporlay\u0131n.",
    isNew: true,
  },
  hydrogen: {
    category: "Hydrogen",
    description:
      "Elektroliz kapasitesi ve elektrik maliyetine g\u00F6re ye\u015Fil hidrojen ekonomisini modelleyin.",
    isNew: true,
  },
};

const homepageTools = getToolDefinitions().map((tool) => {
  const presentation = toolPresentationBySlug[tool.slug] ?? {
    category: "default",
    description: tool.name,
    isNew: false,
  };

  return {
    ...tool,
    category: presentation.category,
    description: presentation.description,
    isNew: presentation.isNew ?? false,
  };
});

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function MarketBarsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-8 w-8 text-[#F59E0B]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 25V14" />
      <path d="M16 25V8" />
      <path d="M24 25v-6" />
      <path d="M5 25h22" />
    </svg>
  );
}

function EngineeringIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-8 w-8 text-[#F59E0B]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.5 6.5a6.5 6.5 0 0 0-7.4 8.13L5.5 20.23a2 2 0 1 0 2.82 2.83l5.6-5.6a6.5 6.5 0 0 0 8.12-7.4l-4.1 4.1-3.04-.76-.76-3.04 4.36-3.87Z" />
    </svg>
  );
}

function ToolCategoryBadge({ category }) {
  const accentColor = categoryColorMap[category] ?? categoryColorMap.default;

  return (
    <span
      style={{
        "--badge-green-bg": hexToRgba(accentColor, 0.14),
        "--badge-green-text": accentColor,
      }}
    >
      <Badge color="green">{category}</Badge>
    </span>
  );
}

function ToolCard({ tool }) {
  const accentColor = categoryColorMap[tool.category] ?? categoryColorMap.default;

  return (
    <article
      className="card-surface h-full cursor-pointer p-5 transition-colors duration-200 hover:border-[#F59E0B]"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <ToolCategoryBadge category={tool.category} />
        {tool.isNew ? (
          <span className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-2 py-1 text-[10px] font-mono font-semibold tracking-[0.14em] text-[#F59E0B]">
            NEW
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-base font-semibold text-[#F8F8F2]">{tool.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#9CA3AF]">
        {tool.description}
      </p>

      <Link
        href={tool.href}
        className="mt-3 inline-block text-sm font-semibold text-[#F59E0B] transition-colors duration-200 hover:text-[#F8F8F2]"
      >
        {"A\u00E7 \u2192"}
      </Link>
    </article>
  );
}

function HowItWorksStep({ step, showConnector }) {
  return (
    <article className="relative">
      {showConnector ? (
        <div className="absolute left-[calc(50%+28px)] top-5 hidden w-[calc(100%-56px)] border-t border-dashed border-[#1E1E2E] md:block" />
      ) : null}

      <div className="relative z-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#F59E0B] font-mono text-sm font-bold text-[#F59E0B]">
          {step.number}
        </div>
        <div className="mt-4 text-2xl leading-none">{step.icon}</div>
        <h3 className="mt-3 font-display text-xl font-semibold text-[#F8F8F2]">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">{step.description}</p>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <>
      <main className="bg-[#0A0A0F] text-[#F8F8F2]">
        <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#0A0A0F]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(#1E1E2E 1px, transparent 1px), repeating-linear-gradient(90deg, #1E1E2E 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0"
            style={{
              width: "600px",
              height: "600px",
              background:
                "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 68%)",
            }}
          />

          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-24 md:py-32">
            <span className="mb-6 inline-flex rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-4 py-1.5 font-mono text-xs text-[#F59E0B]">
              {"T\u00FCrkiye \u00B7 EP\u0130A\u015E \u00B7 AI Tahmin"}
            </span>

            <h1
              className="mb-5 font-display font-bold leading-[1.1] text-[#F8F8F2]"
              style={{ fontSize: "clamp(32px, 5vw, 60px)" }}
            >
              {"T\u00FCrkiye enerji piyasas\u0131n\u0131n "}
              <span className="text-[#F59E0B]">{"trading masas\u0131"}</span>
            </h1>

            <p className="mb-9 max-w-[580px] text-lg leading-8 text-[#9CA3AF] sm:text-xl">
              {"G\u00FCn \u00F6ncesi fiyat analizi, 24 saatlik PTF tahmini ve 15 m\u00FChendislik arac\u0131 \u2014 tek platformda."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/tools"
                className="inline-flex items-center rounded-lg bg-[#F59E0B] px-6 py-3 text-sm font-semibold text-black transition-colors duration-200 hover:bg-[#D97706]"
              >
                {"\u00DCcretsiz ba\u015Fla \u2192"}
              </Link>
              <Link
                href="/tools/market-dashboard"
                className="inline-flex items-center rounded-lg border border-[#1E1E2E] px-6 py-3 text-sm font-semibold text-[#F8F8F2] transition-colors duration-200 hover:border-[#F59E0B]"
              >
                {"Market Dashboard \u2192"}
              </Link>
            </div>

            <div className="mt-12 border-t border-[#1E1E2E] pt-8">
              <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
                {heroStats.map((stat, index) => (
                  <div key={stat.label} className="contents">
                    {index > 0 ? (
                      <span className="text-[#F59E0B]" aria-hidden="true">
                        {"\u00B7"}
                      </span>
                    ) : null}
                    <p className="flex items-center gap-1.5">
                      <span className="text-[#F59E0B]">{stat.accent}</span>
                      <span className="text-[#9CA3AF]">{stat.label}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#1E1E2E] py-6">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="section-label mb-4">
              {"T\u00FCrkiye ve Avrupa'daki enerji profesyonelleri taraf\u0131ndan kullan\u0131lmaktad\u0131r"}
            </p>
            {/* TODO: Replace with actual partner logos */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              {socialProofLogos.map((logo) => (
                <span
                  key={logo}
                  className="rounded border border-[#1E1E2E] px-5 py-2 font-mono text-sm text-[#6B7280]"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeader
              eyebrow="\u0130K\u0130 PLATFORM B\u0130R ARADA"
              title="Enerji ekibinizin ihtiyac\u0131 olan her \u015Fey"
            />

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              <article className="card-surface amber-glow p-8">
                <span className="inline-flex rounded-full bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-xs font-semibold text-[#F59E0B]">
                  {"YEN\u0130"}
                </span>
                <div className="mt-4">
                  <MarketBarsIcon />
                </div>
                <h3 className="mt-4 font-display text-[22px] font-semibold text-[#F8F8F2]">
                  Market Intelligence
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#9CA3AF]">
                  {"EP\u0130A\u015E'tan canl\u0131 PTF verisi, g\u00FCven aral\u0131kl\u0131 24 saatlik tahmin ve fiyat \u00F6r\u00FCnt\u00FCs\u00FC analizi."}
                </p>
                <ul className="mt-4 space-y-2">
                  {platformFeatures.market.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-[#9CA3AF]">
                      <span className="text-[#F59E0B]">{"\u2713"}</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/tools/market-dashboard"
                  className="mt-6 inline-block text-sm font-semibold text-[#F59E0B] hover:underline"
                >
                  {"Dashboard'u A\u00E7 \u2192"}
                </Link>
              </article>

              <article className="card-surface p-8">
                <div>
                  <EngineeringIcon />
                </div>
                <h3 className="mt-4 font-display text-[22px] font-semibold text-[#F8F8F2]">
                  {"M\u00FChendislik Ara\u00E7lar\u0131"}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#9CA3AF]">
                  {"Solar, r\u00FCzgar, depolama, hidrojen ve finansal analiz i\u00E7in 15 hesaplama arac\u0131."}
                </p>
                <ul className="mt-4 space-y-2">
                  {platformFeatures.engineering.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-[#9CA3AF]">
                      <span className="text-[#F59E0B]">{"\u2713"}</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/tools"
                  className="mt-6 inline-block text-sm font-semibold text-[#F59E0B] hover:underline"
                >
                  {"T\u00FCm ara\u00E7lar\u0131 g\u00F6r \u2192"}
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeader
              eyebrow="M\u00DCHEND\u0130SL\u0130K ARA\u00C7LARI"
              title="Proje faz\u0131n\u0131n her ad\u0131m\u0131 i\u00E7in bir ara\u00E7"
            />

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {homepageTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link
                href="/tools"
                className="inline-flex items-center rounded-lg border border-[#F59E0B] px-6 py-3 text-sm font-semibold text-[#F59E0B] transition-colors duration-200 hover:bg-[rgba(245,158,11,0.08)]"
              >
                {"T\u00FCm 15 arac\u0131 g\u00F6r \u2192"}
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#111118] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeader
              eyebrow="NASIL \u00C7ALI\u015EIR"
              title="Ham veriden i\u015Flem karar\u0131na"
            />

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {howItWorksSteps.map((step, index) => (
                <HowItWorksStep
                  key={step.number}
                  step={step}
                  showConnector={index < howItWorksSteps.length - 1}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeader
              eyebrow="F\u0130YATLANDIRMA"
              title="Basit, \u015Feffaf fiyatland\u0131rma"
            />

            <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-[32px]">
              <StripePricingPage />
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="card-surface amber-glow mx-auto max-w-2xl p-12 text-center">
            <h2 className="font-display text-[28px] font-semibold text-[#F8F8F2]">
              {"T\u00FCrkiye enerji piyasas\u0131n\u0131 bug\u00FCn analiz etmeye ba\u015Flay\u0131n"}
            </h2>
            <p className="mt-3 text-sm text-[#9CA3AF] sm:text-base">
              {"\u00DCcretsiz plan mevcut. Kredi kart\u0131 gerekmez."}
            </p>
            <Link
              href="/tools"
              className="mt-6 inline-flex rounded-lg bg-[#F59E0B] px-8 py-3 text-sm font-bold text-black transition-colors duration-200 hover:bg-[#D97706]"
            >
              {"\u00DCcretsiz Ba\u015Fla \u2192"}
            </Link>
          </div>
        </section>
      </main>

      <Head>
        <title>
          Voltiq | AI market intelligence and engineering tools for Turkey&apos;s
          energy market
        </title>
        <meta
          name="description"
          content="Analyze day-ahead power prices, explore 24-hour PTF forecasts, and access 15 engineering tools for solar, wind, storage, hydrogen, and project finance."
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#0A0A0F" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0A0A0F" />
        <meta
          property="og:title"
          content="Voltiq | AI market intelligence and engineering tools for Turkey's energy market"
        />
        <meta
          property="og:description"
          content="Follow EP\u0130A\u015E market signals, review 24-hour PTF forecasts, and work across 15 engineering tools in one platform."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://voltiq.app" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Voltiq | AI market intelligence and engineering tools for Turkey's energy market"
        />
        <meta
          name="twitter:description"
          content="Follow EP\u0130A\u015E market signals, review 24-hour PTF forecasts, and work across 15 engineering tools in one platform."
        />
        <link rel="canonical" href="https://voltiq.app" />
      </Head>
    </>
  );
}
