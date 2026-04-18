import Head from "next/head";
import { useState } from "react";
import { Mail, MessageSquare, Clock } from "lucide-react";

const infoCards = [
  {
    icon: Mail,
    title: "Email",
    description: "Send us a message anytime",
    value: "support@voltiq.app",
    href: "mailto:support@voltiq.app",
  },
  {
    icon: MessageSquare,
    title: "General Inquiries",
    description: "Sales, partnerships, and press",
    value: "hello@voltiq.app",
    href: "mailto:hello@voltiq.app",
  },
  {
    icon: Clock,
    title: "Response Time",
    description: "We typically respond within",
    value: "24 hours",
    href: null,
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | 'error'

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");

    // In production, wire this to an API route or email service
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Head>
        <title>Contact - Voltiq</title>
        <meta
          name="description"
          content="Get in touch with the Voltiq team for support, sales, or partnerships."
        />
      </Head>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
            Get in Touch
          </h1>
          <p className="mt-3 text-[var(--color-muted)] max-w-xl mx-auto">
            Have a question, feedback, or partnership opportunity? We would love to
            hear from you.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {infoCards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center"
            >
              <card.icon className="mx-auto h-6 w-6 text-[var(--color-brand)]" />
              <h3 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                {card.title}
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {card.description}
              </p>
              {card.href ? (
                <a
                  href={card.href}
                  className="mt-2 inline-block text-sm font-medium text-[var(--color-brand)] hover:underline"
                >
                  {card.value}
                </a>
              ) : (
                <p className="mt-2 text-sm font-medium text-[var(--color-brand)]">
                  {card.value}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Send us a message
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Fill in the form below and we will get back to you as soon as possible.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="subject"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
              >
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={form.subject}
                onChange={handleChange}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                placeholder="How can we help?"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={handleChange}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] resize-none"
                placeholder="Tell us more about your question..."
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-[var(--color-brand)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>

            {status === "sent" && (
              <p className="text-sm text-green-600">
                Message sent successfully! We will get back to you soon.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-red-500">
                Something went wrong. Please try again or email us directly.
              </p>
            )}
          </form>
        </div>
      </main>
    </>
  );
}
