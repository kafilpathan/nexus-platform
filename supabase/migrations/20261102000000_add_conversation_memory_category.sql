-- The chat UI stores saved exchanges with category='conversation'.
-- Existing rows were checked before this constraint was extended.
alter table public.nexus_memory
  drop constraint if exists nexus_memory_category_check;

alter table public.nexus_memory
  add constraint nexus_memory_category_check
  check (category in ('project','decision','preference','milestone','lesson','conversation'));
