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

## Jesus Admin menu and chip grants

The Jesus Admin page at `/jesus-admin` is split into three menu-driven sections:

- **Overview**: totals, recent activity, and shortcuts.
- **Prayer Queue**: search/filter orders, fulfill prayers, notes, archive/restore.
- **Give Chips**: grant any number of chips to an email without recording a fake payment.

Administrative chip grants are stored in `c4j_orders` with `payment_status = 'admin_grant'` and `amount_total = 0`. If the recipient already has a Chips for Jesus account, the grant attaches when they refresh/sign in. If they do not have an account yet, it attaches the first time they sign in with the same email address.

If the Give Chips API receives a Postgres permission error, run `supabase_admin_chip_grants.sql` in the Supabase SQL Editor.


## Give Chips API
The admin Give Chips tool uses the top-level Vercel function `/api/give-chips`. Visiting that URL with GET should return `{ ok: true, route: '/api/give-chips' }`, which is a quick deployment health check.

## Prayer Chip gift emails

Administrative Prayer Chip grants send a transactional gift notification after the database grant succeeds.

Required server environment variable:

```text
RESEND_API_KEY=re_...
```

Recommended:

```text
C4J_SITE_URL=https://chipsforjesus.com
C4J_FROM_EMAIL=Chips for Jesus <prayer@chipsforjesus.com>
C4J_REPLY_TO_EMAIL=you@example.com
```

`C4J_FROM_EMAIL` must use a sender/domain that is verified in Resend. Email delivery is intentionally non-fatal: if Resend is unavailable or misconfigured, the Prayer Chips remain granted and Jesus Admin reports the email failure.
