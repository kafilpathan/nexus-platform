-- NEXUS database schema
-- Run this in the Supabase SQL Editor for your NEXUS project.
-- The Netlify Function uses the service-role key for public submissions.
-- The browser admin dashboard uses the anon/publishable key plus Supabase Auth.

create table if not exists public.nexus_problems (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 120),
  category text not null default 'Other',
  details text not null check (char_length(details) between 10 and 3000),
  status text not null default 'Open'
    check (status in ('Open', 'Under Research', 'Tested / Resolved')),
  created_at timestamptz not null default now()
);

-- Admin membership is provisioned manually by the project owner in the SQL Editor.
create table if not exists public.nexus_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.nexus_problems enable row level security;
alter table public.nexus_admins enable row level security;

-- No anonymous browser access. Authenticated users can only verify their own
-- membership; only listed admins can read or update problem submissions.
revoke all on public.nexus_problems from anon, authenticated;
revoke all on public.nexus_admins from anon, authenticated;

grant select on public.nexus_admins to authenticated;
grant select, update on public.nexus_problems to authenticated;

drop policy if exists "Admins can read own membership" on public.nexus_admins;
create policy "Admins can read own membership"
  on public.nexus_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can read problems" on public.nexus_problems;
create policy "Admins can read problems"
  on public.nexus_problems
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.nexus_admins
      where nexus_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can update problems" on public.nexus_problems;
create policy "Admins can update problems"
  on public.nexus_problems
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.nexus_admins
      where nexus_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.nexus_admins
      where nexus_admins.user_id = (select auth.uid())
    )
  );

-- Deliberately no browser INSERT/DELETE policies. Public submissions go
-- through the server-side Netlify Function using its private service key.
