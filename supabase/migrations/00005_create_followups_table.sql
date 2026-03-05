create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  homeowner_name text not null,
  inspection_date date not null,
  status text not null check (status in ('waiting_on_insurance', 'undecided', 'ghosted')),
  followup_content text not null,
  created_at timestamptz not null default now()
);

alter table public.followups enable row level security;

drop policy if exists "Users can view own followups" on public.followups;
create policy "Users can view own followups"
on public.followups
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own followups" on public.followups;
create policy "Users can insert own followups"
on public.followups
for insert
to authenticated
with check (auth.uid() = user_id);