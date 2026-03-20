# StormClose AI - First-Time Setup Guide (Beginner Friendly)

If this is your first time with Supabase, Stripe, external API providers, and Vercel, follow this in order.
Do not skip steps.

---

## What you are setting up

You will connect these 8 services:

1. `Supabase` (database + auth)
2. `Stripe` (subscription billing)
3. `OpenAI` (AI generation)
4. `Xweather` (storm + hail data)
5. `CoreLogic` (property/lead data)
6. `Google APIs` (maps, places, route optimization, solar)
7. `JobNimbus` (CRM integration + webhooks)
8. `Vercel` (hosting/deployment)

---

## 0) One-time prerequisites

Install these on your computer first:

- `Node.js 20+`: https://nodejs.org
- `Git`: https://git-scm.com/downloads
- `Stripe CLI`: https://docs.stripe.com/stripe-cli
- `Supabase CLI`: https://supabase.com/docs/guides/cli

Check they work:

```bash
node -v
npm -v
git --version
stripe --version
supabase --version
```

---

## 1) Set up Supabase (database + auth)

### 1.1 Create account and project

1. Go to https://supabase.com and create an account.
2. Click **New project**.
3. Choose an organization.
4. Set:
  - Project name: `stormclose-ai-prod`
  - Database password: save this in a password manager
  - Region: choose closest to your customers
5. Click **Create new project**.

Wait until status is ready.

### 1.2 Get API keys

In Supabase project:

1. Go to **Project Settings → API**.
2. Copy these values:
  - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → this is `SUPABASE_SERVICE_ROLE_KEY`

### 1.3 Configure Auth URLs

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your app URL (use temp Vercel URL first if needed):
  - `https://app.stormclose.ai` (or temporary `https://<project>.vercel.app`)
3. Add redirect URLs:
  - `https://app.stormclose.ai/callback`
  - `https://<project>.vercel.app/callback`

### 1.4 Run database migrations

From your project root:

```bash
supabase login
supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>
supabase db push
```

`supabase db push` runs all migrations in chronological order. If you run SQL manually in **Supabase SQL Editor**, use this order:

1. `00004_create_reports_table.sql`
2. `00005_create_followups_table.sql`
3. `00006_create_objections_table.sql`
4. `00007_create_users_billing_table.sql`
5. `00008_add_stripe_subscription_id_to_users.sql`
6. `00009_add_subscription_tiers.sql`
7. `00011_add_enterprise_tier.sql`
8. `20260309_command_center.sql`
9. `20260310_add_ai_lead_columns.sql`
10. `20260310_enterprise_features.sql`
11. `20260310_jobnimbus_integration.sql`
12. `20260311_storm_alerts_upgrade.sql`
13. `20260312_create_door_knocks.sql`
14. `20260312_jobnimbus_integration.sql`
15. `20260312_revenue_hub.sql`
16. `20260313_storm_command_center_v2.sql`
17. `20260316_partner_engine_v1.sql`
18. `20260317_jobnimbus_integrations_standalone.sql`
19. `20260318_demo_requests.sql`
20. `20260321_teams_and_team_members.sql`
21. `20260322_fix_team_members_rls_recursion.sql`
22. `20260323_team_notes.sql`
23. `20260324_document_exports.sql`
24. `20260325_partner_engine_team_scope.sql`
25. `20260326_jobnimbus_team_level.sql`
26. `20260327_storm_provider_integrations.sql`
27. `20260327_workflow_runs.sql`

### 1.5 Quick Supabase checks

In **Table Editor**, verify these key tables exist:

- `users`
- `teams`
- `team_members`
- `leads`
- `activities`
- `territories`
- `hail_events`
- `jobnimbus_integrations`

And confirm **RLS is enabled** for tenant-sensitive tables (at minimum: `teams`, `team_members`, `leads`, `activities`, `jobnimbus_integrations`).

---

## 2) Set up Stripe (tiered subscriptions)

### 2.1 Create products and tier prices

1. Go to https://dashboard.stripe.com
2. Switch to correct mode:
  - Start with **Test mode** for setup/testing
3. Go to **Product catalog → Add product**
4. Create or verify 3 recurring monthly prices:
  - `Pro` → `STRIPE_PRICE_ID_PRO`
  - `Enterprise` → `STRIPE_PRICE_ID_ENTERPRISE`
5. Save products/prices.
6. Copy each **Price ID** (looks like `price_...`) into the matching env var.

### 2.2 Get API keys

1. Go to **Developers → API keys**.
2. Copy:
  - Secret key (`sk_test_...` or `sk_live_...`) → `STRIPE_SECRET_KEY`

### 2.3 Configure webhook

1. In Stripe Dashboard go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL:
  - `https://app.stormclose.ai/api/stripe/webhook`
3. Select events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
4. Save endpoint.
5. Copy webhook signing secret (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

---

## 3) Set up OpenAI

1. Go to https://platform.openai.com
2. Create API key.
3. Copy key (`sk-proj-...`) → `OPENAI_API_KEY`.

---

## 3.1) Set up Xweather (storm and hail data)

1. Go to https://www.xweather.com and create developer credentials.
2. Copy:
  - Client ID → `XWEATHER_CLIENT_ID`
  - Client Secret → `XWEATHER_CLIENT_SECRET`

---

## 3.2) Set up CoreLogic (property data)

1. Create CoreLogic API credentials.
2. Copy:
  - Consumer key → `CORELOGIC_CONSUMER_KEY`
  - Consumer secret → `CORELOGIC_CONSUMER_SECRET`

---

## 3.3) Set up Google APIs

Create keys and enable needed APIs (Directions, Geocoding, Places, Maps Embed, Solar):

1. Server key (restricted by IP/service use) → `GOOGLE_MAPS_API_KEY`
2. Browser embed key (restricted by HTTP referrer) → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Solar key (if separated) → `GOOGLE_SOLAR_API_KEY`

---

## 3.4) Set up JobNimbus webhook secret

1. In JobNimbus integration/webhook settings, create a webhook signing secret.
2. Save as `JOBNIMBUS_WEBHOOK_SECRET`.

---

## 4) Configure local environment (your machine)

In project root, create local env file from template:

```bash
cp .env.production.example .env.local
```

Open `.env.local` and fill all values:

- `NEXT_PUBLIC_APP_URL`
- `STRIPE_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ENTERPRISE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)
- `XWEATHER_CLIENT_ID`
- `XWEATHER_CLIENT_SECRET`
- `CORELOGIC_CONSUMER_KEY`
- `CORELOGIC_CONSUMER_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_SOLAR_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `CRON_SECRET`
- `JOBNIMBUS_ENCRYPTION_KEY` (32-char hex for API key encryption)
- `JOBNIMBUS_WEBHOOK_SECRET`
- `RESEND_API_KEY` (for demo requests and team invites)
- `RESEND_FROM_EMAIL` (e.g. `StormClose <noreply@stormclose.com>`)
- `DEMO_REQUEST_EMAIL` (where demo requests are sent)
- `STORM_PROVIDER_ENCRYPTION_KEY` (if using HailTrace/HailRecon)

Run app locally:

```bash
npm ci
npm run dev
```

Open: `http://localhost:3000`

---

## 5) Connect Stripe webhook to local app (for testing)

In a second terminal:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Stripe CLI will print a webhook secret.
If you use that local tunnel secret, update `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## 6) Deploy to Vercel

### 6.1 Create project

1. Go to https://vercel.com
2. Click **Add New → Project**
3. Import your GitHub repo (`StormAI`)
4. Framework should auto-detect as Next.js

### 6.2 Add environment variables in Vercel

Before first production deploy, add all env vars in:

**Project Settings → Environment Variables**

Add exactly:

- `NEXT_PUBLIC_APP_URL`
- `STRIPE_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ENTERPRISE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `XWEATHER_CLIENT_ID`
- `XWEATHER_CLIENT_SECRET`
- `CORELOGIC_CONSUMER_KEY`
- `CORELOGIC_CONSUMER_SECRET`
- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_SOLAR_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `CRON_SECRET`
- `JOBNIMBUS_ENCRYPTION_KEY`
- `JOBNIMBUS_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `DEMO_REQUEST_EMAIL`
- `STORM_PROVIDER_ENCRYPTION_KEY` (if using storm provider integrations)

### 6.3 Deploy

1. Click **Deploy**.
2. Wait for build to pass.
3. Copy generated Vercel URL (`https://<project>.vercel.app`).

---

## 7) Connect custom domain

1. In Vercel project go to **Settings → Domains**.
2. Add your domain (example: `app.stormclose.ai`).
3. Vercel will show DNS records to add in your DNS provider.
4. Add those records at your domain registrar.
5. Wait for SSL to issue (can take a few minutes).

Then update these places to final domain:

- Supabase Auth Site URL + Redirect URLs
- Stripe webhook endpoint URL
- `NEXT_PUBLIC_APP_URL` in Vercel env vars

Redeploy after updates.

---

## 8) Production verification (click-by-click)

Do this after deployment:

1. Create a new account via `/signup`
2. Log in
3. Try to open `/dashboard`
  - Should redirect to `/subscribe` if no active plan
4. Complete Stripe checkout
5. Confirm webhook runs and updates user subscription
6. Open `/dashboard` again
  - Should now allow access
7. Test `/dashboard/report`
  - Generate report
  - Confirm row saved in Supabase `reports`
8. Test `/dashboard/followup`
  - Generate follow-up
  - Confirm row saved in Supabase `followups`

---

## 9) Production safety checklist

- [ ] Legal pages live: `/privacy`, `/terms`, `/security`
- [ ] All env vars set in Vercel (see `.env.example` for full list)
- [ ] Stripe webhook URL points to production
- [ ] JobNimbus webhook URL configured if using CRM sync
- [ ] Supabase Auth redirect URLs include production domain
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Never expose `STRIPE_SECRET_KEY` in frontend code
- Never expose `OPENAI_API_KEY` in frontend code
- Keep Stripe webhook signature validation enabled
- Keep Supabase RLS enabled on user data tables
- Rotate keys immediately if leaked
- Enable Vercel monitoring/log alerts

---

## 10) Useful commands

```bash
npm ci
npm run build
npm run dev
```

---

If you get stuck on any one step, complete up to that step and share the exact screen/error, and I can walk you through it line-by-line.
