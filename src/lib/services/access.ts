/**
 * Authorization rules — the application-level mirror of the RLS policies in
 * supabase/migrations/*_rls_auth_realtime.sql. Every service mutation and
 * every role-filtered read goes through here.
 */
import type { Conversation, ConversationParticipant, Task } from "../db/types";
import { he } from "../i18n/he";
import { AccessError, type ProjectSession } from "./session";

export function isPM(s: Pick<ProjectSession, "role">) {
  return s.role === "pm";
}

export function isStaff(s: Pick<ProjectSession, "role">) {
  return s.role === "pm" || s.role === "viewer";
}

export function assertPM(s: Pick<ProjectSession, "role">) {
  if (s.role !== "pm") throw new AccessError(he.errors.pmOnly, 403);
}

/** Staff see every task of the project; contractors only their own. */
export function canSeeTask(s: ProjectSession, task: Pick<Task, "project_id" | "contractor_id">) {
  if (task.project_id !== s.project.id) return false;
  if (isStaff(s)) return true;
  return !!task.contractor_id && s.contractorIds.includes(task.contractor_id);
}

export function visibleTasks<T extends Pick<Task, "project_id" | "contractor_id">>(s: ProjectSession, tasks: T[]): T[] {
  return tasks.filter((t) => canSeeTask(s, t));
}

/** The PM sees every conversation of the project; others only those they're in. */
export function canSeeConversation(
  s: ProjectSession,
  conv: Pick<Conversation, "project_id" | "id">,
  participants: Pick<ConversationParticipant, "profile_id">[],
) {
  if (conv.project_id !== s.project.id) return false;
  if (isPM(s)) return true;
  return participants.some((p) => p.profile_id === s.profile.id);
}

export function assertCanReportTask(s: ProjectSession, task: Pick<Task, "project_id" | "contractor_id">) {
  if (task.project_id !== s.project.id) throw new AccessError(he.errors.notFound, 404);
  if (isPM(s)) return;
  if (s.role === "contractor" && task.contractor_id && s.contractorIds.includes(task.contractor_id)) return;
  throw new AccessError(he.errors.forbidden, 403);
}
