create table if not exists public.app_store (
    key text primary key,
    value jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_store enable row level security;

drop policy if exists "Service role full access on app_store" on public.app_store;

create policy "Service role full access on app_store"
on public.app_store
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
