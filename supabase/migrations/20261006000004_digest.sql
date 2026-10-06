-- Morning digest reminders (one per person per local day).
alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('check', 'overdue', 'no_response', 'escalation', 'critical_blocker', 'digest'));
