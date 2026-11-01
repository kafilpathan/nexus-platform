-- NEXUS KAF-AI Evolution Engine schema.
-- This file is committed for review only. It is NOT applied to Supabase by this PR.
-- All tables are admin-only and protected by RLS. No service-role key is used in browsers.

create table if not exists public.nexus_experiments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  objective text not null check (char_length(objective) between 1 and 1200),
  parameters jsonb not null default '{}'::jsonb,
  baseline_score numeric,
  candidate_score numeric,
  status text not null default 'proposed'
    check (status in ('proposed', 'eligible_for_review', 'approved', 'rejected')),
  notes text not null default '' check (char_length(notes) <= 3000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexus_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  node_type text not null check (char_length(node_type) between 1 and 40),
  description text not null check (char_length(description) between 1 and 1200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_title text check (source_title is null or char_length(source_title) <= 200),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nexus_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.nexus_knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.nexus_knowledge_nodes(id) on delete cascade,
  relation_type text not null check (char_length(relation_type) between 1 and 60),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nexus_knowledge_edges_no_self check (source_node_id <> target_node_id),
  constraint nexus_knowledge_edges_unique unique (source_node_id, target_node_id, relation_type)
);

create table if not exists public.nexus_evaluations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid references public.nexus_experiments(id) on delete set null,
  suite_version text not null default 'v1' check (char_length(suite_version) between 1 and 40),
  metrics jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  summary text not null default '' check (char_length(summary) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists nexus_experiments_created_at_idx
  on public.nexus_experiments (created_at desc);
create index if not exists nexus_knowledge_nodes_type_idx
  on public.nexus_knowledge_nodes (node_type, created_at desc);
create index if not exists nexus_knowledge_edges_source_idx
  on public.nexus_knowledge_edges (source_node_id);
create index if not exists nexus_knowledge_edges_target_idx
  on public.nexus_knowledge_edges (target_node_id);
create index if not exists nexus_evaluations_experiment_idx
  on public.nexus_evaluations (experiment_id, created_at desc);

alter table public.nexus_experiments enable row level security;
alter table public.nexus_knowledge_nodes enable row level security;
alter table public.nexus_knowledge_edges enable row level security;
alter table public.nexus_evaluations enable row level security;

-- Supabase Data API grants are separate from RLS. Grant only to authenticated;
-- each policy still requires membership in nexus_admins.
grant select, insert, update, delete on public.nexus_experiments to authenticated;
grant select, insert, update, delete on public.nexus_knowledge_nodes to authenticated;
grant select, insert, update, delete on public.nexus_knowledge_edges to authenticated;
grant select, insert, update, delete on public.nexus_evaluations to authenticated;

create policy "NEXUS admins manage experiments"
  on public.nexus_experiments for all to authenticated
  using (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())));

create policy "NEXUS admins manage knowledge nodes"
  on public.nexus_knowledge_nodes for all to authenticated
  using (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())));

create policy "NEXUS admins manage knowledge edges"
  on public.nexus_knowledge_edges for all to authenticated
  using (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())));

create policy "NEXUS admins manage evaluations"
  on public.nexus_evaluations for all to authenticated
  using (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())));
