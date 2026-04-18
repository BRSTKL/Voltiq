import Head from "next/head";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using Voltiq, you agree to be bound by these Terms of Service. If you do not agree, you may not use the platform. We reserve the right to update these terms at any time — continued use constitutes acceptance.",
  },
  {
    title: "2. Description of Service",
    content:
      "Voltiq provides web-based engineering calculation tools for renewable energy professionals. Our tools include solar yield estimation, wind energy analysis, battery storage sizing, LCOE comparison, and other related calculators. Results are provided for informational and preliminary analysis purposes.",
  },
  {
    title: "3. User Accounts",
    content:
      "You must create an account to access Voltiq tools. You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information during registration. We reserve the right to suspend or terminate accounts that violate these terms.",
  },
  {
    title: "4. Subscription Plans & Billing",
    content:
      "Voltiq offers Free, Pro, and Enterprise plans. Free accounts have limited daily calculations and access to a subset of tools. Paid subscriptions are billed through Stripe on a recurring basis. You may cancel your subscription at any time — access continues until the end of the current billing period. Refunds are handled on a case-by-case basis.",
  },
  {
    title: "5. Acceptable Use",
    items: [
      "You may not use Voltiq for any unlawful purpose.",
      "You may not attempt to reverse-engineer, scrape, or overload the platform.",
      "You may not share your account credentials with others.",
      "You may not use automated tools to access the service beyond permitted API usage.",
      "Violation of these rules may result in immediate account termination.",
    ],
  },
  {
    title: "6. Intellectual Property",
    content:
      "All content, design, code, and branding of Voltiq are owned by Voltiq and protected by intellectual property laws. Your calculation inputs and saved results remain your property. You grant us a limited license to store and process your data solely to provide the service.",
  },
  {
    title: "7. Disclaimer of Warranties",
    content:
      'Voltiq is provided "as is" and "as available" without warranties of any kind, either express or implied. Calculation results are for preliminary analysis and informational purposes only. They should not be used as the sole basis for engineering decisions, financial investments, or regulatory compliance. Always verify results with qualified professionals and site-specific data.',
  },
  {
    title: "8. Limitation of Liability",
    content:
      "To the maximum extent permitted by law, Voltiq shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the 12 months preceding the claim.",
  },
  {
    title: "9. Data & Privacy",
    content:
      "Your use of Voltiq is also governed by our Privacy Policy. By using the service, you consent to the collection and use of information as described in the Privacy Policy.",
  },
  {
    title: "10. Termination",
    content:
      "We may suspend or terminate your access to Voltiq at any time for violation of these terms, without prior notice. Upon termination, your right to use the service ceases immediately. You may request deletion of your data by contacting support.",
  },
  {
    title: "11. Governing Law",
    content:
      "These terms are governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration or in the courts of the applicable jurisdiction.",
  },
];

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms of Service - Voltiq</title>
        <meta
          name="description"
          content="Voltiq terms of service — rules and guidelines for using our platform."
        />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Last updated: March 28, 2026
        </p>
        <p className="mt-6 text-[var(--color-muted)] leading-relaxed">
          Please read these Terms of Service carefully before using Voltiq. These
          terms govern your access to and use of our renewable energy
          calculation platform.
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {section.title}
              </h2>
              {section.content && (
                <p className="mt-3 text-[var(--color-muted)] leading-relaxed">
                  {section.content}
                </p>
              )}
              {section.items && (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-[var(--color-muted)] leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[10px] before:h-1 before:w-1 before:rounded-full before:bg-[var(--color-brand)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-sm text-[var(--color-muted)]">
            Questions about these terms? Contact us at{" "}
            <a
              href="mailto:support@voltiq.app"
              className="text-[var(--color-brand)] hover:underline"
            >
              support@voltiq.app
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
