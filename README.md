# StormClose AI - First-Time Setup Guide (Beginner Friendly)

If this is your first time with Supabase, Stripe, and Vercel, follow this in order.
Do not skip steps.

---

## What you are setting up

You will connect these 4 services:

1. `Supabase` (database + auth)
2. `Stripe` (monthly subscriptions)
3. `OpenAI` (AI generation)
4. `Vercel` (hosting/deployment)

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

From your project root (`/Users/matthewweikel/projects/StormAI`):

```bash
supabase login
supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>
supabase db push
```

If CLI feels hard, you can also run SQL files manually in **Supabase SQL Editor** in this exact order:

1. `supabase/migrations/00001_initial_schema.sql`
2. `supabase/migrations/00002_add_projects.sql`
3. `supabase/migrations/00003_add_estimates.sql`
4. `supabase/migrations/00004_create_reports_table.sql`
5. `supabase/migrations/00005_create_followups_table.sql`

### 1.5 Quick Supabase checks

In **Table Editor**, verify these tables exist:

- `users`
- `reports`
- `followups`

And confirm **RLS is enabled** for `reports` and `followups`.

---

## 2) Set up Stripe (monthly subscription)

### 2.1 Create product and monthly price

1. Go to https://dashboard.stripe.com
2. Switch to correct mode:
  - Start with **Test mode** for setup/testing
3. Go to **Product catalog → Add product**
4. Create product:
  - Name: `StormClose AI Monthly`
5. Add price:
  - Recurring
  - Monthly
  - Pick your amount (example: `$99/month`)
6. Save product.
7. Copy the **Price ID** (looks like `price_...`) → this is `STRIPE_PRICE_ID_MONTHLY`.

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

## 4) Configure local environment (your machine)

In project root, create local env file from template:

```bash
cp .env.production.example .env.local
```

Open `.env.local` and fill all values:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MONTHLY`
- `OPENAI_API_KEY`

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
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MONTHLY`
- `OPENAI_API_KEY`

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
