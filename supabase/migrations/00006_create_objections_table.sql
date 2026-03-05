create table if not exists public.objections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  homeowner_name text,
  objection text not null,
  project_type text not null,
  key_benefits text[] not null,
  evidence_points text[] not null default '{}',
  tone text not null check (tone in ('consultative', 'confident', 'empathetic')),
  response_content text not null,
  created_at timestamptz not null default now()
);

alter table public.objections enable row level security;

drop policy if exists "Users can view own objections" on public.objections;
create policy "Users can view own objections"
on public.objections
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own objections" on public.objections;
create policy "Users can insert own objections"
on public.objections
for insert
to authenticated
with check (auth.uid() = user_id);