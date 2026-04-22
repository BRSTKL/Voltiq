export const metadata = {
  title: "Privacy Policy | Voltiq",
  description: "How Voltiq collects, uses, and protects your data.",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: [
      "Account Information: When you create an account, we collect your name, email address, and profile picture if you sign in with Google.",
      "Usage Data: We log which calculation tools you use and when, to enforce plan limits and improve our service.",
      "Payment Information: Payment details are processed securely by Stripe. We store only your Stripe customer ID and subscription status.",
      "Calculation Data: If you save a calculation, we store the inputs and outputs you provide. You can delete saved calculations from your dashboard.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    content: [
      "To provide, maintain, and improve the Voltiq platform.",
      "To manage your account, subscriptions, and usage limits.",
      "To send transactional emails such as sign-in links and subscription confirmations.",
      "To detect and prevent fraud, abuse, or security incidents.",
      "We do not sell your personal data to third parties.",
    ],
  },
  {
    title: "3. Data Sharing",
    content: [
      "Stripe: For payment processing and subscription management.",
      "Google: If you choose to sign in with Google OAuth.",
      "Resend: For sending transactional emails such as sign-in links.",
      "We do not share your data with advertisers or data brokers.",
    ],
  },
  {
    title: "4. Data Retention",
    content: [
      "We retain your account data for as long as your account is active.",
      "Usage logs are retained for 90 days for rate-limiting and analytics purposes.",
      "If you delete your account, associated data is permanently deleted within 30 days.",
    ],
  },
  {
    title: "5. Your Rights",
    content: [
      "Access: Request a copy of your personal data at any time.",
      "Deletion: Request deletion of your account and associated data.",
      "Portability: Export your saved calculations in standard formats.",
      "Correction: Update your account information from your dashboard.",
      "To exercise any of these rights, contact us at support@voltiq.app.",
    ],
  },
  {
    title: "6. Cookies & Tracking",
    content: [
      "We use essential cookies for authentication and session management.",
      "We do not use advertising cookies or third-party tracking scripts.",
      "You can manage cookie preferences in your browser settings.",
    ],
  },
  {
    title: "7. Security",
    content: [
      "All data is transmitted over HTTPS with TLS encryption.",
      "Database connections use SSL encryption.",
      "We follow industry-standard security practices including secure headers, input validation, and dependency audits.",
    ],
  },
  {
    title: "8. Changes to This Policy",
    content: [
      "We may update this Privacy Policy from time to time.",
      "Continued use of Voltiq after changes constitutes acceptance of the updated policy.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">Last updated: March 28, 2026</p>
      <p className="mt-6 leading-relaxed text-[var(--color-muted)]">
        Voltiq (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to
        protecting your privacy. This policy explains how we collect, use, and safeguard
        your information when you use our platform.
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{section.title}</h2>
            <ul className="mt-3 space-y-2">
              {section.content.map((item) => (
                <li
                  key={item}
                  className="relative pl-4 leading-relaxed text-[var(--color-muted)] before:absolute before:left-0 before:top-[10px] before:h-1 before:w-1 before:rounded-full before:bg-[var(--color-brand)] before:content-['']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-sm text-[var(--color-muted)]">
          If you have questions about this privacy policy, contact us at{" "}
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
