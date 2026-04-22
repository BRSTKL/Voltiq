export const metadata = {
  title: "Terms of Service | Voltiq",
  description: "Rules and guidelines for using Voltiq.",
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using Voltiq, you agree to be bound by these Terms of Service. If you do not agree, you may not use the platform. We reserve the right to update these terms at any time, and continued use constitutes acceptance.",
  },
  {
    title: "2. Description of Service",
    content:
      "Voltiq provides web-based engineering calculation tools for renewable energy professionals. Results are provided for informational and preliminary analysis purposes.",
  },
  {
    title: "3. User Accounts",
    content:
      "You must create an account to access certain Voltiq features. You are responsible for maintaining the confidentiality of your credentials and for providing accurate account information.",
  },
  {
    title: "4. Subscription Plans & Billing",
    content:
      "Voltiq offers Free, Pro, and Enterprise plans. Paid subscriptions are billed through Stripe on a recurring basis. You may cancel your subscription at any time and access continues until the end of the current billing period.",
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
      "All content, design, code, and branding of Voltiq are owned by Voltiq and protected by intellectual property laws. Your calculation inputs and saved results remain your property.",
  },
  {
    title: "7. Disclaimer of Warranties",
    content:
      'Voltiq is provided "as is" and "as available" without warranties of any kind. Calculation results are for preliminary analysis and should not be used as the sole basis for engineering decisions, investments, or regulatory compliance.',
  },
  {
    title: "8. Limitation of Liability",
    content:
      "To the maximum extent permitted by law, Voltiq shall not be liable for indirect or consequential damages arising from your use of the service.",
  },
  {
    title: "9. Data & Privacy",
    content:
      "Your use of Voltiq is also governed by our Privacy Policy. By using the service, you consent to the collection and use of information as described there.",
  },
  {
    title: "10. Termination",
    content:
      "We may suspend or terminate your access to Voltiq at any time for violation of these terms. You may request deletion of your data by contacting support.",
  },
  {
    title: "11. Governing Law",
    content:
      "These terms are governed by and construed in accordance with applicable laws. Any disputes shall be resolved through arbitration or in the courts of the applicable jurisdiction.",
  },
];

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">Last updated: March 28, 2026</p>
      <p className="mt-6 leading-relaxed text-[var(--color-muted)]">
        Please read these Terms of Service carefully before using Voltiq. These terms
        govern your access to and use of our renewable energy calculation platform.
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{section.title}</h2>
            {section.content ? (
              <p className="mt-3 leading-relaxed text-[var(--color-muted)]">
                {section.content}
              </p>
            ) : null}
            {section.items ? (
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="relative pl-4 leading-relaxed text-[var(--color-muted)] before:absolute before:left-0 before:top-[10px] before:h-1 before:w-1 before:rounded-full before:bg-[var(--color-brand)] before:content-['']"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
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
    </section>
  );
}
