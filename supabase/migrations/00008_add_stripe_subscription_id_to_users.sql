alter table public.users
  add column if not exists stripe_subscription_id text;

create index if not exists users_stripe_subscription_id_idx
  on public.users (stripe_subscription_id);
