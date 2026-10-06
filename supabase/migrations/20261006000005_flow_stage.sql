-- Tasks generated from the master construction process remember their stage,
-- so the process flowchart can show live status per apartment.
alter table public.tasks add column if not exists flow_stage text;
create index if not exists tasks_flow_stage_idx on public.tasks (area_id, flow_stage) where flow_stage is not null;
