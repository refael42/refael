import { randomUUID } from "node:crypto";
import { matches, PRIMARY_KEYS, sortRows, StoreError, type InsertRow, type Query, type Row, type Store, type Where } from "./store";
import type { TableName, Tables } from "./types";

export type ChangeEvent = {
  table: TableName;
  type: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};
type Listener = (e: ChangeEvent) => void;

/** Column defaults — mirror the SQL defaults so both stores behave the same. */
const DEFAULTS: { [K in TableName]?: () => Partial<Tables[K]> } = {
  projects: () => ({ setup_mode: false, address: null, start_date: null, target_date: null }),
  tasks: () => ({
    status: "planned",
    is_critical: false,
    description: null,
    area_id: null,
    trade_id: null,
    contractor_id: null,
    planned_start: null,
    planned_end: null,
    check_at: null,
    started_at: null,
    completed_at: null,
    blocked_reason: null,
    created_from_message_id: null,
    plan_pin_id: null,
    flow_stage: null,
    external_ref: null,
    created_by: null,
  }),
  dependencies: () => ({
    type: "finish_to_start",
    lag_hours: 0,
    source: "manual",
    from_task_id: null,
    from_blocker_id: null,
    created_by: null,
  }),
  external_blockers: () => ({
    status: "open",
    owner_name: null,
    owner_phone: null,
    notes: null,
    expected_date: null,
    resolved_at: null,
    created_from_message_id: null,
  }),
  rules: () => ({
    scope: "same_area",
    lag_hours: 0,
    active: true,
    source: "custom",
    predecessor_keyword: null,
    successor_keyword: null,
    organization_id: null,
  }),
  messages: () => ({
    kind: "text",
    text: null,
    media_url: null,
    reply_to_id: null,
    ai_parsed_json: null,
    ai_status: "none",
    ai_reviewed_by: null,
    ai_reviewed_at: null,
    meta: null,
    sender_profile_id: null,
  }),
  completion_reports: () => ({
    photo_urls: [],
    note: null,
    status: "pending",
    reviewed_by: null,
    review_comment: null,
    reviewed_at: null,
    message_id: null,
    contractor_id: null,
    submitted_by: null,
  }),
  reminders: () => ({
    status: "pending",
    sent_at: null,
    task_id: null,
    message_id: null,
    blocker_id: null,
    target_profile_id: null,
  }),
  notifications: () => ({ body: null, link: null, action: null, urgent: false, read_at: null, project_id: null }),
  conversation_participants: () => ({ last_read_at: null }),
  conversations: () => ({ title: null, last_message_at: null }),
  profiles: () => ({ auth_user_id: null, organization_id: null, phone: null, email: null }),
  areas: () => ({ parent_id: null, sort_order: 0, features: [] }),
  contractors: () => ({ profile_id: null, phone: null, trade_id: null, company: null }),
  plan_files: () => ({ floor_area_id: null, created_by: null }),
  plan_pins: () => ({ page: 1, area_id: null, label: null }),
  audit_log: () => ({ from_value: null, to_value: null, actor_profile_id: null, meta: null, project_id: null }),
};

const UNIQUE: { [K in TableName]?: Array<Array<keyof Tables[K] & string>> } = {
  reminders: [["dedupe_key"]],
  push_subscriptions: [["endpoint"]],
  trades: [["key"]],
};

export { StoreError };

const clone = <T>(v: T): T => structuredClone(v);

export type MemoryData = { [K in TableName]: Tables[K][] };

export function emptyData(): MemoryData {
  return {
    organizations: [],
    profiles: [],
    projects: [],
    project_members: [],
    areas: [],
    trades: [],
    contractors: [],
    tasks: [],
    dependencies: [],
    external_blockers: [],
    rules: [],
    rule_feedback: [],
    conversations: [],
    conversation_participants: [],
    messages: [],
    message_links: [],
    completion_reports: [],
    plan_files: [],
    plan_pins: [],
    reminders: [],
    notifications: [],
    push_subscriptions: [],
    audit_log: [],
    flow_templates: [],
  };
}

/**
 * In-memory store used in demo mode and in tests. Emits change events that
 * the demo SSE endpoint forwards to browsers (stand-in for Supabase Realtime).
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private listeners = new Set<Listener>();
  /** Clock override for deterministic tests. */
  now: () => Date = () => new Date();

  constructor(public data: MemoryData = emptyData()) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ChangeEvent) {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* a broken listener must not break writes */
      }
    }
    this.onChange?.();
  }

  /** Hook used for persistence. */
  onChange?: () => void;

  private rows<K extends TableName>(table: K): Tables[K][] {
    return this.data[table] as Tables[K][];
  }

  async select<K extends TableName>(table: K, query: Query<Row<K>> = {}): Promise<Row<K>[]> {
    let out = this.rows(table).filter((r) => matches(r, query.where));
    out = sortRows(out, query.order);
    if (query.limit !== undefined) out = out.slice(0, query.limit);
    return clone(out);
  }

  async first<K extends TableName>(table: K, query: Query<Row<K>> = {}): Promise<Row<K> | null> {
    const [row] = await this.select(table, { ...query, limit: 1 });
    return row ?? null;
  }

  async byId<K extends TableName>(table: K, id: string): Promise<Row<K> | null> {
    const row = this.rows(table).find((r) => (r as { id?: string }).id === id);
    return row ? clone(row) : null;
  }

  async insert<K extends TableName>(table: K, input: InsertRow<K> | InsertRow<K>[]): Promise<Row<K>[]> {
    const list = Array.isArray(input) ? input : [input];
    const nowIso = this.now().toISOString();
    const created: Row<K>[] = [];
    for (const partial of list) {
      const defaults = (DEFAULTS[table] as (() => Partial<Row<K>>) | undefined)?.() ?? {};
      const row = { ...defaults, ...clone(partial) } as Record<string, unknown>;
      if (!PRIMARY_KEYS[table] && !row.id) row.id = randomUUID();
      if (!("created_at" in row) || !row.created_at) {
        if (table !== "trades") row.created_at = nowIso;
      }
      if (table === "tasks" && !row.updated_at) row.updated_at = row.created_at;
      this.checkConstraints(table, row);
      this.rows(table).push(row as unknown as Row<K>);
      created.push(clone(row) as unknown as Row<K>);
      this.afterInsert(table, row);
      this.emit({ table, type: "INSERT", new: clone(row), old: null });
    }
    return created;
  }

  async update<K extends TableName>(table: K, where: Where<Row<K>>, patch: Partial<Row<K>>): Promise<Row<K>[]> {
    const updated: Row<K>[] = [];
    for (const row of this.rows(table)) {
      if (!matches(row, where)) continue;
      const old = clone(row);
      Object.assign(row as object, clone(patch));
      if (table === "tasks") (row as unknown as { updated_at: string }).updated_at = this.now().toISOString();
      try {
        this.checkConstraints(table, row as unknown as Record<string, unknown>, row);
      } catch (e) {
        Object.assign(row as object, old);
        throw e;
      }
      updated.push(clone(row));
      this.emit({ table, type: "UPDATE", new: clone(row) as unknown as Record<string, unknown>, old: old as unknown as Record<string, unknown> });
    }
    return updated;
  }

  async remove<K extends TableName>(table: K, where: Where<Row<K>>): Promise<number> {
    const rows = this.rows(table);
    const keep: Row<K>[] = [];
    const gone: Row<K>[] = [];
    for (const r of rows) (matches(r, where) ? gone : keep).push(r);
    (this.data as Record<string, unknown>)[table] = keep;
    for (const g of gone) {
      this.emit({ table, type: "DELETE", new: null, old: clone(g) as unknown as Record<string, unknown> });
      this.cascadeDelete(table, g as unknown as Record<string, unknown>);
    }
    return gone.length;
  }

  /** The subset of DB constraints the app relies on. */
  private checkConstraints(table: TableName, row: Record<string, unknown>, self?: unknown) {
    for (const cols of UNIQUE[table] ?? []) {
      const clash = (this.rows(table) as unknown as Record<string, unknown>[]).find(
        (r) => r !== self && cols.every((c) => r[c] === row[c]),
      );
      if (clash) throw new StoreError(`unique violation on ${table}(${cols.join(",")})`, "unique");
    }
    const pk = PRIMARY_KEYS[table];
    if (pk && !self) {
      const clash = (this.rows(table) as unknown as Record<string, unknown>[]).find((r) =>
        pk.every((c) => r[c] === row[c]),
      );
      if (clash) throw new StoreError(`duplicate key on ${table}`, "unique");
    }
    if (table === "dependencies") {
      if ((row.from_task_id == null) === (row.from_blocker_id == null))
        throw new StoreError("dependency needs exactly one source", "invalid");
      if (row.from_task_id && row.from_task_id === row.to_task_id) throw new StoreError("self dependency", "cycle");
      const dup = this.data.dependencies.find(
        (d) =>
          d !== self &&
          d.to_task_id === row.to_task_id &&
          ((row.from_task_id && d.from_task_id === row.from_task_id) ||
            (row.from_blocker_id && d.from_blocker_id === row.from_blocker_id)),
      );
      if (dup) throw new StoreError("duplicate dependency", "unique");
      if (row.from_task_id && this.reaches(row.to_task_id as string, row.from_task_id as string, self))
        throw new StoreError("dependency would create a cycle", "cycle");
    }
    if (table === "tasks" && row.status === "done" && !row.completed_at)
      throw new StoreError("done task needs completed_at", "invalid");
  }

  private reaches(from: string, target: string, skip?: unknown): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const d of this.data.dependencies) if (d !== skip && d.from_task_id === cur) stack.push(d.to_task_id);
    }
    return false;
  }

  private afterInsert(table: TableName, row: Record<string, unknown>) {
    if (table === "messages") {
      const conv = this.data.conversations.find((c) => c.id === row.conversation_id);
      if (conv && (!conv.last_message_at || conv.last_message_at < (row.created_at as string))) {
        const old = clone(conv);
        conv.last_message_at = row.created_at as string;
        this.emit({ table: "conversations", type: "UPDATE", new: clone(conv) as never, old: old as never });
      }
    }
  }

  /** ON DELETE CASCADE for the relations the app deletes through. */
  private cascadeDelete(table: TableName, row: Record<string, unknown>) {
    const id = row.id as string;
    if (table === "tasks") {
      void this.remove("dependencies", { from_task_id: id });
      void this.remove("dependencies", { to_task_id: id });
      void this.remove("message_links", { task_id: id });
      void this.remove("completion_reports", { task_id: id });
      void this.remove("reminders", { task_id: id });
    } else if (table === "external_blockers") {
      void this.remove("dependencies", { from_blocker_id: id });
    } else if (table === "plan_files") {
      void this.remove("plan_pins", { plan_file_id: id });
    }
  }
}
