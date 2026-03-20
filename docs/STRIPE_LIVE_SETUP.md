# Stripe Live Mode — Setup Complete

Your `.env.local` is now configured for live payments. Here's what's in place and what you need to do.

## ✅ Already configured

- **STRIPE_SECRET_KEY** — Live secret key (`sk_live_...`)
- **STRIPE_PRICE_ID_PRO** — Live Pro price (`price_1TCXB4L34QpRoPm7brJaRDMt`)
- **STRIPE_PRICE_ID_ENTERPRISE** — Live Enterprise price (`price_1TCXACL34QpRoPm7L9KJoG15`)
- Fixed: Removed the override that was resetting `STRIPE_PRICE_ID_PRO` to the old test price

## ⚠️ Required: Live webhook secret

Your `STRIPE_WEBHOOK_SECRET` is still a placeholder. **Payments will complete, but the database won't update** (subscription status, customer ID) until you add the real secret.

### How to get it

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) and switch to **Live** mode (top-right toggle).
2. **Developers → Webhooks → Add endpoint**
3. Endpoint URL: `https://www.stormclose.com/api/stripe/webhook` (or your production URL)
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Click **Reveal** under "Signing secret"
7. Copy the `whsec_...` value
8. Update `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET="whsec_your_actual_live_secret"
   ```

## Production (Vercel)

Add these to **Vercel → Project → Settings → Environment Variables** for **Production**:

- `STRIPE_SECRET_KEY` = your live secret key
- `STRIPE_WEBHOOK_SECRET` = the live webhook signing secret (from step above)
- `STRIPE_PRICE_ID_PRO` = `price_1TCXB4L34QpRoPm7brJaRDMt`
- `STRIPE_PRICE_ID_ENTERPRISE` = `price_1TCXACL34QpRoPm7L9KJoG15`
- `STRIPE_APP_URL` = `https://www.stormclose.com`

Then redeploy.

## Database

No changes needed. The `users` table already has `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, and `subscription_tier`. The webhook updates these when a payment succeeds.
