-- Features of a place: apartments ('garden', 'duplex'), buildings ('parking',
-- 'elevator', 'sprinklers'), and which shared part a common area is
-- ('roof', 'stairwell', 'lobby', …). Process stages marked `when` apply only
-- where the feature exists.
alter table public.areas add column if not exists features text[] not null default '{}';

-- One editable process per company per kind: 'apartment' and 'building'
-- (the building's shared parts).
alter table public.flow_templates add column if not exists kind text not null default 'apartment'
  check (kind in ('apartment', 'building'));
alter table public.flow_templates drop constraint if exists flow_templates_pkey;
alter table public.flow_templates add primary key (organization_id, kind);
