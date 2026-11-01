-- NEXUS persistent project memory, scoped to the authenticated owner.
create table if not exists public.nexus_memory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  memory_key text not null check (char_length(memory_key) between 2 and 100),
  memory_value text not null check (char_length(memory_value) between 1 and 4000),
  category text not null default 'project'
    check (category in ('project','decision','preference','milestone','lesson','conversation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, memory_key)
);
alter table public.nexus_memory enable row level security;
drop policy if exists "Users read their own NEXUS memory" on public.nexus_memory;
create policy "Users read their own NEXUS memory" on public.nexus_memory for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Users insert their own NEXUS memory" on public.nexus_memory;
create policy "Users insert their own NEXUS memory" on public.nexus_memory for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Users update their own NEXUS memory" on public.nexus_memory;
create policy "Users update their own NEXUS memory" on public.nexus_memory for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists "Users delete their own NEXUS memory" on public.nexus_memory;
create policy "Users delete their own NEXUS memory" on public.nexus_memory for delete to authenticated using ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.nexus_memory to authenticated;
