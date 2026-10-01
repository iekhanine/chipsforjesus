# Chips for Jesus

Vite + React + TypeScript site with Stripe Checkout, Supabase Auth, member accounts, Jesus Admin, and Vercel serverless functions.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the existing OneTime Labs Stripe and Supabase values.
3. Run the SQL migration in the existing Supabase project:

```text
supabase/migrations/20260930_c4j_members.sql
```

4. Install and run through Vercel:

```powershell
npm install
npx vercel dev
```

Then open `http://localhost:3000`.

Use `npx vercel dev`, not only `npm run dev`, because checkout, member, webhook, and admin routes use `/api/*` Vercel functions.

## Main routes

- `/` public purchase page
- `/create-account` Stripe success/account claim page
- `/login` Google or email/password member login
- `/members` My Chips dashboard
- `/forgot-password` forgot password
- `/reset-password` choose a new password
- `/jesus-admin` Google OAuth protected admin

## Stripe products

- Prayer Chip: `price_1ULX5xAX0lI7Mdm6Z47wVYSP`
- Pray for Ivan: `price_1ULX62AX0lI7Mdm63IOotnaM`

## Authentication

The app reuses the same Supabase project as the OneTime Labs Store/LBG.

- Jesus Admin uses Google OAuth and additionally checks `JESUS_ADMIN_EMAILS` server-side.
- Members can use Google OAuth or email/password.
- Successful Stripe buyers are redirected to `/create-account` with the Checkout Session ID.
- The purchase email comes from Stripe and is locked on the create-account form.
- Member purchases are permanently linked to the authenticated Supabase user ID after server-side email verification.

See `JESUS_ADMIN_SETUP.md` for the complete Supabase redirect URL list and deployment steps.

## Webhook

Keep the Stripe webhook endpoint:

```text
https://chipsforjesus.com/api/stripe-webhook
```

Subscribe to:

```text
checkout.session.completed
```

Never create `VITE_STRIPE_SECRET_KEY` or `VITE_SUPABASE_SERVICE_ROLE_KEY`. Any `VITE_` variable is bundled into browser code.

Admin identity: `iekhanine@gmail.com` is always recognized as a Jesus Admin account by the server. `JESUS_ADMIN_EMAILS` may still be used to add additional admin emails.
