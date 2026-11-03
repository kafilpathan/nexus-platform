-- Phase 1: cover foreign-key columns flagged by Supabase performance advisors.
-- These indexes are additive and do not alter or delete application data.
create index if not exists nexus_evaluations_created_by_idx
  on public.nexus_evaluations (created_by);

create index if not exists nexus_experiments_created_by_idx
  on public.nexus_experiments (created_by);

create index if not exists nexus_experiments_reviewed_by_idx
  on public.nexus_experiments (reviewed_by);

create index if not exists nexus_knowledge_edges_created_by_idx
  on public.nexus_knowledge_edges (created_by);

create index if not exists nexus_knowledge_nodes_created_by_idx
  on public.nexus_knowledge_nodes (created_by);
