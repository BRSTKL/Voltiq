const requiredServerEnvs = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_ENTERPRISE",
] as const;

const optionalServerEnvs = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_RESEND_KEY",
  "ADMIN_EMAIL",
  // Secures hourly market sync cron requests in production.
  "CRON_SECRET",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of requiredServerEnvs) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  const warnings: string[] = [];
  for (const key of optionalServerEnvs) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[Voltiq] Optional environment variables not set: ${warnings.join(", ")}`
    );
  }
}

// Validates required env vars at startup — throws if missing.
if (typeof window === "undefined") {
  validateEnv();
}
