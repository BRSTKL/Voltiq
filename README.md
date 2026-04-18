# Voltiq

## Stripe webhook setup on Vercel

1. Add these environment variables in Vercel for the Voltiq project:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_ENTERPRISE`
   - `NEXTAUTH_URL`
2. In the Stripe Dashboard, create a webhook endpoint that points to:
   - `https://<your-domain>/api/stripe/webhook`
3. Subscribe the webhook to these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret from Stripe into `STRIPE_WEBHOOK_SECRET` in Vercel.
5. For local development, forward Stripe events with the Stripe CLI:
   - `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
6. Use the signing secret printed by the CLI as your local `STRIPE_WEBHOOK_SECRET`.
