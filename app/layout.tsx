import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.css";
import "@/lib/env";

import AuthSessionProvider from "@/components/AuthSessionProvider";

export const metadata: Metadata = {
  title: {
    default: "Voltiq | Renewable Energy Calculation Tools",
    template: "%s | Voltiq",
  },
  description:
    "Professional renewable energy engineering tools. Solar yield, wind energy, battery storage, LCOE, and 11 more calculators. Start free.",
  metadataBase: new URL("https://voltiq.io"),
  openGraph: {
    title: "Voltiq | Renewable Energy Calculation Tools",
    description:
      "15 engineering tools for solar, wind, battery storage, LCOE, and more. Start free.",
    url: "https://voltiq.io",
    siteName: "Voltiq",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voltiq | Renewable Energy Calculation Tools",
    description:
      "15 engineering tools for solar, wind, battery storage, LCOE, and more.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
