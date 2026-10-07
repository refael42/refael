import type { Store } from "../db/store";
import type { AuditEntry, ChangeSource } from "../db/types";

export async function audit(
  store: Store,
  e: {
    projectId: string;
    entityType: AuditEntry["entity_type"];
    entityId: string;
    action: string;
    from?: string | null;
    to?: string | null;
    actor: string | null;
    source: ChangeSource;
    meta?: Record<string, unknown>;
  },
) {
  await store.insert("audit_log", {
    project_id: e.projectId,
    entity_type: e.entityType,
    entity_id: e.entityId,
    action: e.action,
    from_value: e.from ?? null,
    to_value: e.to ?? null,
    actor_profile_id: e.actor,
    source: e.source,
    meta: e.meta ?? null,
  });
}
