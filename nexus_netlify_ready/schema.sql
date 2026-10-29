-- Run this in the Supabase SQL Editor for your NEXUS project.
create table if not exists public.nexus_problems (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 120),
  category text not null default 'Other',
  details text not null check (char_length(details) between 10 and 3000),
  status text not null default 'Open' check (status in ('Open','Under Research','Tested / Resolved')),
  created_at timestamptz not null default now()
);

-- Keep direct client access disabled. The Node server uses the service-role key.
alter table public.nexus_problems enable row level security;
revoke all on public.nexus_problems from anon, authenticated;
