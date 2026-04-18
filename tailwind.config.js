/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        volt: {
          bg: "#0A0A0F",
          surface: "#111118",
          elevated: "#1A1A24",
          border: "#1E1E2E",
          accent: "#F59E0B",
          "accent-hover": "#D97706",
          muted: "#374151",
          subtle: "#6B7280",
        },
        status: {
          success: "#10B981",
          danger: "#EF4444",
          warning: "#F59E0B",
          info: "#3B82F6",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "amber-glow": "0 0 24px rgba(245,158,11,0.12)",
        card: "0 1px 3px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
