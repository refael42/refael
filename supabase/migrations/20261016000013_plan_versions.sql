-- Plans: discipline, sheet, revision, versions, the areas a plan covers, and its text (for search and "what changed").
alter table public.plan_files
  add column if not exists discipline    text,
  add column if not exists sheet         text,
  add column if not exists revision      text,
  add column if not exists version       integer not null default 1,
  add column if not exists supersedes_id uuid references public.plan_files(id) on delete set null,
  add column if not exists is_current    boolean not null default true,
  add column if not exists area_ids      uuid[] not null default '{}',
  add column if not exists page_count    integer,
  add column if not exists text_index    text,
  add column if not exists change_note   text;

create index if not exists plan_files_current_idx on public.plan_files (project_id, is_current);
create index if not exists plan_files_supersedes_idx on public.plan_files (supersedes_id);
