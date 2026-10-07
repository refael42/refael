import type { TableName, Tables } from "./types";

type Scalar = string | number | boolean | null;

/** A column condition. A bare value means equality (null means IS NULL). */
export type Cond<V> =
  | V
  | { in: readonly NonNullable<V>[] }
  | { neq: V }
  | { gt: V }
  | { gte: V }
  | { lt: V }
  | { lte: V };

export type Where<T> = { [K in keyof T]?: Cond<T[K]> };

export interface Query<T> {
  where?: Where<T>;
  order?: Array<[keyof T & string, "asc" | "desc"]>;
  limit?: number;
}

export type Row<K extends TableName> = Tables[K];
export type InsertRow<K extends TableName> = Partial<Tables[K]>;

/**
 * Minimal table store. Services are written once against this interface and
 * run unchanged on Supabase (Postgres) or the in-memory demo store.
 */
export interface Store {
  readonly kind: "supabase" | "memory";
  select<K extends TableName>(table: K, query?: Query<Row<K>>): Promise<Row<K>[]>;
  first<K extends TableName>(table: K, query?: Query<Row<K>>): Promise<Row<K> | null>;
  byId<K extends TableName>(table: K, id: string): Promise<Row<K> | null>;
  insert<K extends TableName>(table: K, rows: InsertRow<K> | InsertRow<K>[]): Promise<Row<K>[]>;
  update<K extends TableName>(table: K, where: Where<Row<K>>, patch: Partial<Row<K>>): Promise<Row<K>[]>;
  remove<K extends TableName>(table: K, where: Where<Row<K>>): Promise<number>;
}

const OPS = ["in", "neq", "gt", "gte", "lt", "lte"] as const;
export type OpName = (typeof OPS)[number];

export function asOp(cond: unknown): { op: OpName; value: unknown } | null {
  if (cond === null || typeof cond !== "object" || Array.isArray(cond)) return null;
  const keys = Object.keys(cond);
  if (keys.length !== 1 || !(OPS as readonly string[]).includes(keys[0])) return null;
  return { op: keys[0] as OpName, value: (cond as Record<string, unknown>)[keys[0]] };
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as Scalar)! < (b as Scalar)! ? -1 : 1;
}

/** Evaluate a Where clause in JS — used by the memory store and in tests. */
export function matches<T>(row: T, where?: Where<T>): boolean {
  if (!where) return true;
  for (const [col, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const v = (row as Record<string, unknown>)[col] ?? null;
    const op = asOp(cond);
    if (!op) {
      if (v !== cond) return false;
      continue;
    }
    switch (op.op) {
      case "in":
        if (!(op.value as unknown[]).includes(v)) return false;
        break;
      case "neq":
        if (v === op.value) return false;
        break;
      case "gt":
        if (v === null || cmp(v, op.value) <= 0) return false;
        break;
      case "gte":
        if (v === null || cmp(v, op.value) < 0) return false;
        break;
      case "lt":
        if (v === null || cmp(v, op.value) >= 0) return false;
        break;
      case "lte":
        if (v === null || cmp(v, op.value) > 0) return false;
        break;
    }
  }
  return true;
}

export function sortRows<T>(rows: T[], order?: Query<T>["order"]): T[] {
  if (!order?.length) return rows;
  return [...rows].sort((a, b) => {
    for (const [col, dir] of order) {
      const c = cmp((a as Record<string, unknown>)[col], (b as Record<string, unknown>)[col]);
      if (c !== 0) return dir === "asc" ? c : -c;
    }
    return 0;
  });
}

/** Composite primary keys (tables without an `id` column). */
export const PRIMARY_KEYS: Partial<Record<TableName, string[]>> = {
  project_members: ["project_id", "profile_id"],
  conversation_participants: ["conversation_id", "profile_id"],
  message_links: ["message_id", "task_id"],
  flow_templates: ["organization_id", "kind"],
};

export class StoreError extends Error {
  constructor(
    message: string,
    public code: "unique" | "cycle" | "not_found" | "invalid",
  ) {
    super(message);
  }
}
