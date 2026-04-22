import Link from "next/link";

import StripePricingPage from "@/components/StripePricingPage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getToolDefinitions } from "@/lib/toolRegistry";

export const metadata = {
  title: "Voltiq | Turkiye Enerji Piyasasi Analizi",
  description:
    "Gun oncesi PTF analizi, market dashboard ve muhendislik araclari tek platformda.",
};

const categoryColorMap = {
  Solar: "#F59E0B",
  Wind: "#3B82F6",
  Storage: "#8B5CF6",
  Financial: "#10B981",
  Sustainability: "#06B6D4",
  Electrical: "#EF4444",
  Hydrogen: "#EC4899",
  default: "#6B7280",
} as const;

const heroStats = [
  { accent: "15", label: "arac" },
  { accent: "EPIAS", label: "verisi" },
  { accent: "Ucretsiz", label: "basla" },
];

const socialProofLogos = ["ENERJI A.S.", "TRADING LTD.", "RENEWABLES CO.", "GRID CORP."];

const platformFeatures = {
  market: [
    "Saatlik PTF gecmisi",
    "24 saatlik fiyat tahmini",
    "Peak/off-peak isi haritasi",
    "Gunluk oruntu analizi",
  ],
  engineering: [
    "Solar ve ruzgar verim tahmini",
    "LCOE ve ROI hesaplayicilari",
    "PDF ve Excel disa aktarma",
    "AI muhendislik ozetleri",
  ],
};

const howItWorksSteps = [
  {
    number: "01",
    title: "Baglan",
    description: "EPIAS Seffaflik Platformu'ndan PTF verisini saatlik olarak cekin.",
  },
  {
    number: "02",
    title: "Analiz Et",
    description: "Fiyat gecmisini, oruntuleri ve anomalileri kesfedin.",
  },
  {
    number: "03",
    title: "Tahmin Et",
    description: "Guven aralikli 24 saatlik PTF tahminleri alin.",
  },
];

const toolPresentationBySlug = {
  "site-assessment": {
    category: "Solar",
    description:
      "Solar proje sahalarini kaynak, sebeke, topografya ve regülasyon acisindan tarayin.",
    isNew: true,
  },
  solar: {
    category: "Solar",
    description:
      "Gercek iklim verisiyle uretim tahmini, spesifik yield ve sistem optimizasyonu.",
  },
  wind: {
    category: "Wind",
    description:
      "Hub yuksekligi, Weibull dagilimi ve turbin egrileriyle ruzgar uretim tahmini.",
  },
  shading: {
    category: "Solar",
    description: "Golgeleme, horizon profili ve inverter davranisiyla kayip etkisini simule edin.",
  },
  "pv-loss": {
    category: "Solar",
    description: "Irradiance'tan net AC cikisina kadar PV kayip zincirini adim adim gorun.",
    isNew: true,
  },
  "inverter-sizing": {
    category: "Solar",
    description:
      "String voltaj penceresi, DC/AC orani ve clipping riskini tasarima gore dogrulayin.",
    isNew: true,
  },
  cable: {
    category: "Electrical",
    description: "IEC tabanli DC/AC kablo boyutlandirma, voltage drop ve ampacity kontrolu.",
    isNew: true,
  },
  battery: {
    category: "Storage",
    description: "LFP, NMC ve lead-acid secenekleriyle uygun batarya kapasitesini hesaplayin.",
  },
  "storage-roi": {
    category: "Storage",
    description:
      "Peak shaving, arbitrage ve yedekleme senaryolariyla depolama yatirimini modelleyin.",
    isNew: true,
  },
  roi: {
    category: "Financial",
    description:
      "25 yillik nakit akisi, geri odeme suresi ve fiyat artis etkisini gorun.",
  },
  lcoe: {
    category: "Financial",
    description:
      "Solar, ruzgar ve diger teknolojiler icin LCOE ve hassasiyet karsilastirmasi yapin.",
    isNew: true,
  },
  carbon: {
    category: "Sustainability",
    description:
      "Ulke bazli grid karbon yogunlugu, enerji karisimi ve footprint karsilastirmasi.",
    isNew: true,
  },
  "land-use-capacity": {
    category: "Solar",
    description:
      "Arazi alanindan kurulu guc, panel sayisi ve inverter on-boyutlandirmasini cikarın.",
    isNew: true,
  },
  scope2: {
    category: "Sustainability",
    description: "Location-based ve market-based Scope 2 emisyonlarini hizlica raporlayin.",
    isNew: true,
  },
  hydrogen: {
    category: "Hydrogen",
    description:
      "Elektroliz kapasitesi ve elektrik maliyetine gore yesil hidrojen ekonomisini modelleyin.",
    isNew: true,
  },
};

const homepageTools = getToolDefinitions().map((tool) => {
  const presentation = Object.assign(
    {
      category: "default",
      description: tool.name,
      isNew: false,
    },
    toolPresentationBySlug[tool.slug as keyof typeof toolPresentationBySlug] ?? {}
  );

  return {
    ...tool,
    category: presentation.category,
    description: presentation.description,
    isNew: presentation.isNew,
  };
});

function hexToRgba(hex: string, alpha: number) {
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

function ToolCategoryBadge({ category }: { category: string }) {
  const accentColor =
    categoryColorMap[category as keyof typeof categoryColorMap] ?? categoryColorMap.default;

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]"
      style={{ backgroundColor: hexToRgba(accentColor, 0.14), color: accentColor }}
    >
      {category}
    </span>
  );
}

function ToolCard({
  tool,
}: {
  tool: {
    slug: string;
    name: string;
    href: string;
    description: string;
    category: string;
    isNew: boolean;
  };
}) {
  const accentColor =
    categoryColorMap[tool.category as keyof typeof categoryColorMap] ?? categoryColorMap.default;

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
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#9CA3AF]">{tool.description}</p>
      <Link
        href={tool.href}
        className="mt-3 inline-block text-sm font-semibold text-[#F59E0B] transition-colors duration-200 hover:text-[#F8F8F2]"
      >
        Ac →
      </Link>
    </article>
  );
}

function HowItWorksStep({
  step,
  showConnector,
}: {
  step: { number: string; title: string; description: string };
  showConnector: boolean;
}) {
  return (
    <article className="relative">
      {showConnector ? (
        <div className="absolute left-[calc(50%+28px)] top-5 hidden w-[calc(100%-56px)] border-t border-dashed border-[#1E1E2E] md:block" />
      ) : null}
      <div className="relative z-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#F59E0B] font-mono text-sm font-bold text-[#F59E0B]">
          {step.number}
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-[#F8F8F2]">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">{step.description}</p>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <div className="bg-[#0A0A0F] text-[#F8F8F2]">
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
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 68%)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-24 md:py-32">
          <span className="mb-6 inline-flex rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-4 py-1.5 font-mono text-xs text-[#F59E0B]">
            Turkiye · EPIAS · AI Tahmin
          </span>

          <h1
            className="mb-5 font-display font-bold leading-[1.1] text-[#F8F8F2]"
            style={{ fontSize: "clamp(32px, 5vw, 60px)" }}
          >
            Turkiye enerji piyasasinin <span className="text-[#F59E0B]">trading masasi</span>
          </h1>

          <p className="mb-9 max-w-[580px] text-lg leading-8 text-[#9CA3AF] sm:text-xl">
            Gun oncesi fiyat analizi, 24 saatlik PTF tahmini ve 15 muhendislik araci -
            tek platformda.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tools"
              className="inline-flex items-center rounded-lg bg-[#F59E0B] px-6 py-3 text-sm font-semibold text-black transition-colors duration-200 hover:bg-[#D97706]"
            >
              Ucretsiz basla →
            </Link>
            <Link
              href="/tools/market-dashboard"
              className="inline-flex items-center rounded-lg border border-[#1E1E2E] px-6 py-3 text-sm font-semibold text-[#F8F8F2] transition-colors duration-200 hover:border-[#F59E0B]"
            >
              Market Dashboard →
            </Link>
          </div>

          <div className="mt-12 border-t border-[#1E1E2E] pt-8">
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
              {heroStats.map((stat, index) => (
                <div key={stat.label} className="contents">
                  {index > 0 ? <span className="text-[#F59E0B]">·</span> : null}
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
            Turkiye ve Avrupa'daki enerji profesyonelleri tarafindan kullaniliyor
          </p>
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
            eyebrow="IKI PLATFORM BIR ARADA"
            title="Enerji ekibinizin ihtiyaci olan her sey"
          />

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="card-surface amber-glow p-8">
              <span className="inline-flex rounded-full bg-[rgba(245,158,11,0.15)] px-2 py-0.5 text-xs font-semibold text-[#F59E0B]">
                YENI
              </span>
              <h3 className="mt-4 font-display text-[22px] font-semibold text-[#F8F8F2]">
                Market Intelligence
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#9CA3AF]">
                EPIAS'tan canli PTF verisi, guven aralikli 24 saatlik tahmin ve fiyat
                oruntusu analizi.
              </p>
              <ul className="mt-4 space-y-2">
                {platformFeatures.market.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-[#9CA3AF]">
                    <span className="text-[#F59E0B]">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/tools/market-dashboard"
                className="mt-6 inline-block text-sm font-semibold text-[#F59E0B] hover:underline"
              >
                Dashboard'u ac →
              </Link>
            </article>

            <article className="card-surface p-8">
              <h3 className="mt-1 font-display text-[22px] font-semibold text-[#F8F8F2]">
                Muhendislik Araclari
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#9CA3AF]">
                Solar, ruzgar, depolama, hidrojen ve finansal analiz icin 15 hesaplama
                araci.
              </p>
              <ul className="mt-4 space-y-2">
                {platformFeatures.engineering.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-[#9CA3AF]">
                    <span className="text-[#F59E0B]">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/tools"
                className="mt-6 inline-block text-sm font-semibold text-[#F59E0B] hover:underline"
              >
                Tum araclari gor →
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader
            eyebrow="MUHENDISLIK ARACLARI"
            title="Proje fazinin her adimi icin bir arac"
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
              Tum 15 araci gor →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#111118] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeader eyebrow="NASIL CALISIR" title="Ham veriden islem kararina" />
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
          <SectionHeader eyebrow="FIYATLANDIRMA" title="Basit, seffaf fiyatlandirma" />
          <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-[32px]">
            <StripePricingPage />
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="card-surface amber-glow mx-auto max-w-2xl p-12 text-center">
          <h2 className="font-display text-[28px] font-semibold text-[#F8F8F2]">
            Turkiye enerji piyasasini bugun analiz etmeye baslayin
          </h2>
          <p className="mt-3 text-sm text-[#9CA3AF] sm:text-base">
            Ucretsiz plan mevcut. Kredi karti gerekmez.
          </p>
          <Link
            href="/tools"
            className="mt-6 inline-flex rounded-lg bg-[#F59E0B] px-8 py-3 text-sm font-bold text-black transition-colors duration-200 hover:bg-[#D97706]"
          >
            Ucretsiz Basla →
          </Link>
        </div>
      </section>
    </div>
  );
}
