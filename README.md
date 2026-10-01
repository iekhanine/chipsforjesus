# Chips for Jesus

Vite + React + TypeScript site with Stripe Checkout and Vercel serverless functions.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Stripe live secret key.
3. For local API testing, use Vercel's local runtime:

```powershell
npm install
npx vercel dev
```

Then open `http://localhost:3000`.

Running only `npm run dev` starts Vite, but `/api/*` functions will not be available unless you separately proxy them. For this project, `npx vercel dev` is the simplest local workflow.

## Stripe products already created

- Prayer Chip: `price_1ULX5xAX0lI7Mdm6Z47wVYSP`
- Pray for Ivan: `price_1ULX62AX0lI7Mdm63IOotnaM`

These are live prices in the connected OneTime Labs Stripe account.

## Vercel environment variables

Add these in Vercel Project Settings > Environment Variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRAYER_CHIP`
- `STRIPE_PRICE_PRAY_FOR_IVAN`
- `SITE_URL`
- `STRIPE_WEBHOOK_SECRET`

Never create a variable named `VITE_STRIPE_SECRET_KEY`. Any `VITE_` variable is exposed to the browser.

## Webhook

After deploying, create a Stripe webhook endpoint for:

`https://chipsforjesus.com/api/stripe-webhook`

Subscribe to:

`checkout.session.completed`

Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` locally and in Vercel.
