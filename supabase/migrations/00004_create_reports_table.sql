create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_address text not null,
  roof_type text not null,
  shingle_type text not null,
  damage_notes text not null,
  insurance_company text not null,
  slopes_damaged integer not null check (slopes_damaged >= 0),
  report_content text not null,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports"
on public.reports
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own reports" on public.reports;
create policy "Users can insert own reports"
on public.reports
for insert
to authenticated
with check (auth.uid() = user_id);