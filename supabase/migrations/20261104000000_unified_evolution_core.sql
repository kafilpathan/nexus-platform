-- Unified NEXUS KAF-AI Evolution Core: evaluation, experiments, knowledge and governance.
-- Existing engine tables are defined here so a fresh project can apply the full schema.
create table if not exists public.nexus_experiments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  objective text not null check (char_length(objective) between 1 and 1200),
  parameters jsonb not null default '{}'::jsonb,
  notes text not null default '',
  status text not null default 'proposed' check (status in ('proposed','eligible_for_review','approved','rejected','rolled_back')),
  baseline_score numeric(6,5),
  candidate_score numeric(6,5),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nexus_evaluations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid references public.nexus_experiments(id) on delete set null,
  suite_version text not null default 'v1',
  metrics jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  summary text not null default '',
  self_declaration text check (self_declaration in ('successful','partially_successful','not_successful')),
  self_assessment jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.nexus_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  node_type text not null check (char_length(node_type) between 1 and 40),
  description text not null check (char_length(description) between 1 and 1200),
  source_url text,
  source_title text,
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.nexus_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.nexus_knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.nexus_knowledge_nodes(id) on delete cascade,
  relation_type text not null check (char_length(relation_type) between 1 and 60),
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nexus_knowledge_no_self_edge check (source_node_id <> target_node_id)
);
create table if not exists public.nexus_evolution_versions (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.nexus_experiments(id) on delete cascade,
  evaluation_id uuid references public.nexus_evaluations(id) on delete set null,
  version_label text not null check (char_length(version_label) between 1 and 100),
  change_summary text not null default '',
  status text not null default 'candidate' check (status in ('candidate','approved','active','rolled_back')),
  rollback_of uuid references public.nexus_evolution_versions(id),
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists nexus_experiments_status_created_idx on public.nexus_experiments(status, created_at desc);
create index if not exists nexus_evaluations_experiment_created_idx on public.nexus_evaluations(experiment_id, created_at desc);
create index if not exists nexus_knowledge_nodes_type_created_idx on public.nexus_knowledge_nodes(node_type, created_at desc);
create index if not exists nexus_knowledge_edges_source_idx on public.nexus_knowledge_edges(source_node_id);
create index if not exists nexus_knowledge_edges_target_idx on public.nexus_knowledge_edges(target_node_id);
create index if not exists nexus_evolution_versions_experiment_idx on public.nexus_evolution_versions(experiment_id, created_at desc);

-- Admin-only access: Worker verifies Supabase Auth and membership before every engine request.
do $$
declare t text;
begin
  foreach t in array array['nexus_experiments','nexus_evaluations','nexus_knowledge_nodes','nexus_knowledge_edges','nexus_evolution_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "NEXUS admins manage %s" on public.%I', t, t);
    execute format('create policy "NEXUS admins manage %s" on public.%I for all to authenticated using (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid()))) with check (exists (select 1 from public.nexus_admins a where a.user_id = (select auth.uid())))', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
