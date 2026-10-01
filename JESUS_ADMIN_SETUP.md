# Chips for Jesus auth, members, and Jesus Admin setup

This build uses the existing OneTime Labs Supabase project for authentication and database storage, and the existing OneTime Labs Stripe account for payments.

## Routes

- `/jesus-admin` - Google OAuth only, plus `JESUS_ADMIN_EMAILS` allowlist
- `/create-account` - Stripe return page after a successful purchase
- `/login` - member Google OAuth or email/password login
- `/members` - My Chips member dashboard
- `/forgot-password` - password reset request
- `/reset-password` - choose a new password after following the reset email

## 1. Install dependencies

```powershell
npm install
```

## 2. Run the database migration

In the existing OneTime Labs Supabase project, open SQL Editor and run:

```text
supabase/migrations/20260930_c4j_members.sql
```

The migration creates or upgrades `public.c4j_orders` and adds durable member ownership through `member_user_id`.

Browser clients do not read this table directly. RLS stays enabled with no public policies. Vercel server functions verify the Supabase access token and use the service-role key.

## 3. Environment variables

Reuse the same Supabase project credentials already used by the Store / LBG:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
JESUS_ADMIN_EMAILS=YOUR_GOOGLE_EMAIL
```

Keep the existing Stripe variables:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_PRAYER_CHIP=price_1ULX5xAX0lI7Mdm6Z47wVYSP
STRIPE_PRICE_PRAY_FOR_IVAN=price_1ULX62AX0lI7Mdm63IOotnaM
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://chipsforjesus.com
```

Add the same required values in Vercel Development and Production.

## 4. Google OAuth

No second Google OAuth app is required if this same Supabase project already has Google enabled and working for Store/LBG.

Jesus Admin now calls Supabase `signInWithOAuth({ provider: 'google' })`. After Supabase authenticates Google, the server checks that the signed-in email appears in `JESUS_ADMIN_EMAILS`.

## 5. Supabase redirect URLs

In Supabase -> Authentication -> URL Configuration -> Redirect URLs, add these alongside the existing Store/LBG URLs:

```text
https://chipsforjesus.com/jesus-admin
https://chipsforjesus.com/members
https://chipsforjesus.com/reset-password
http://localhost:3000/jesus-admin
http://localhost:3000/members
http://localhost:3000/reset-password
```

The code uses explicit `redirectTo` / `emailRedirectTo` values, so you do not need to replace the Supabase project's existing Site URL.

## 6. Email/password provider

In Supabase -> Authentication -> Providers, make sure the Email provider is enabled if you want members to create passwords and use forgot-password.

For production password confirmation/reset emails, use the SMTP configuration you already trust for the shared Supabase project. Supabase's built-in trial mailer is rate-limited, so it should not be treated as the long-term production mail service.

## 7. Post-payment account flow

Stripe Checkout now returns successful buyers to:

```text
https://chipsforjesus.com/create-account?session_id={CHECKOUT_SESSION_ID}
```

The page retrieves that Stripe session server-side and locks account creation to the email used at Stripe Checkout.

The buyer can then:

- Continue with Google
- Create an email/password Supabase account
- Sign in if they already have an account

A pending Checkout Session ID is saved locally. After authentication, `/members` calls `/api/member/claim-checkout`. The server retrieves Stripe directly, confirms payment is complete, confirms the Stripe email matches the authenticated Supabase email, and attaches the purchase to that Supabase user ID.

The normal Stripe webhook still saves the order too. Both paths are idempotent.

## 8. Member dashboard

`/members` shows:

- chips purchased
- how many have been prayed for
- how many are still waiting
- prayers purchased for Ivan
- total purchases / amount paid
- each prayer request
- per-order prayer progress
- completed timestamp when applicable

On first authenticated load, any older unclaimed orders with the same verified email are automatically claimed to that member's Supabase user ID.

## 9. Password reset

`/forgot-password` calls Supabase `resetPasswordForEmail()` and sends the buyer to `/reset-password` from the email link. The reset page calls `updateUser({ password })` and then returns them to `/members`.

## 10. Stripe webhook

Keep:

```text
https://chipsforjesus.com/api/stripe-webhook
```

listening to:

```text
checkout.session.completed
```

## 11. Local development

Use Vercel dev so `/api` routes run:

```powershell
npx vercel dev
```

Then test:

```text
http://localhost:3000
http://localhost:3000/jesus-admin
http://localhost:3000/login
http://localhost:3000/members
```

Admin identity: `iekhanine@gmail.com` is always recognized as a Jesus Admin account by the server. `JESUS_ADMIN_EMAILS` may still be used to add additional admin emails.

## 12. Prayer Chip gift emails

When Jesus Admin sends an administrative Prayer Chip grant, the database grant is created first. The server then sends a transactional gift email through Resend.

Required:

```env
RESEND_API_KEY=re_...
```

Recommended:

```env
C4J_SITE_URL=https://chipsforjesus.com
C4J_FROM_EMAIL=Chips for Jesus <prayer@chipsforjesus.com>
C4J_REPLY_TO_EMAIL=you@example.com
```

For compatibility, `RESEND_FROM_EMAIL` or `NOTIFICATION_FROM_EMAIL` can be used instead of `C4J_FROM_EMAIL`.

The sender domain used by `C4J_FROM_EMAIL` must be verified in Resend before it can send to arbitrary recipients. For production, verify `chipsforjesus.com` and use an address on that domain.

Email sending is intentionally non-fatal. If Resend fails, the Prayer Chips stay granted and Jesus Admin reports that the gift succeeded but the email failed.
