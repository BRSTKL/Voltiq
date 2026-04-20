# Voltiq Deployment Checklist

## Required Environment Variables
- `DATABASE_URL`: Prisma/Postgres connection string.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID for Auth.js sign-in.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret for Auth.js sign-in.
- `NEXTAUTH_SECRET`: Auth.js session encryption and signing secret.
- `NEXTAUTH_URL`: Production base URL used by Auth.js and Stripe redirects.
- `AUTH_RESEND_KEY`: Resend API key for magic-link email login.
- `ADMIN_EMAIL`: Email address allowed through admin middleware gating.
- `STRIPE_SECRET_KEY`: Stripe server-side secret key for checkout and billing APIs.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret for `/api/stripe/webhook`.
- `STRIPE_PRICE_PRO`: Stripe Price ID for the Pro checkout flow.
- `STRIPE_PRICE_ENTERPRISE`: Stripe Price ID for the Enterprise checkout flow.
- `NEXT_PUBLIC_GEMINI_API_KEY`: Client-side Gemini API key used by AI summary features.
- `NEXT_PUBLIC_ELECTRICITYMAPS_TOKEN`: Client-side Electricity Maps token used by the carbon tool.
- `CRON_SECRET`: Secret token that authorizes `/api/market/sync` cron requests.

## Pre-deployment Steps
- [ ] Run: `npx prisma migrate deploy`
- [ ] Verify EPİAŞ API accessible (confirm a successful authorized `GET /api/market/sync` in Vercel function logs)
- [ ] Stripe webhook URL updated to production: `https://voltiq.io/api/stripe/webhook`
- [ ] `NEXTAUTH_URL` set to: `https://voltiq.io`
- [ ] `CRON_SECRET` set (random 32-char string)
- [ ] Google OAuth callback URL: `https://voltiq.io/api/auth/callback/google`

## Vercel Cron Job
`vercel.json` is configured with hourly EPİAŞ sync via `/api/market/sync`.
Verify in Vercel Dashboard > Settings > Cron Jobs after first deployment.

## Post-deployment Testing Checklist
- [ ] `/` homepage loads with dark theme
- [ ] `/tools` shows market banner + all 15 tools
- [ ] `/tools/market-dashboard` loads (with mock data if EPİAŞ unavailable)
- [ ] `/tools/solar` works end-to-end
- [ ] `/pricing` shows Stripe pricing
- [ ] `/docs` shows two-column layout
- [ ] `/login` shows Google + magic link options
- [ ] Google sign-in completes successfully
- [ ] `/dashboard` loads for authenticated user
- [ ] `GET /api/market/prices` returns JSON
- [ ] `GET /api/market/stats` returns JSON

## Known Limitations
- EPİAŞ API may be geo-restricted to Turkish IPs.
  If sync returns mock data after deployment, set up a Turkish VPS proxy.
  Proxy endpoint should forward: `GET /api/market/sync` -> EPİAŞ API.
