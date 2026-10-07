import type { SupabaseClient } from "@supabase/supabase-js";
import { asOp, StoreError, type InsertRow, type Query, type Row, type Store, type Where } from "./store";
import type { TableName } from "./types";

const PAGE = 1000;

type Builder = any;

function applyWhere(q: Builder, where?: Where<unknown>): Builder | null {
  if (!where) return q;
  for (const [col, cond] of Object.entries(where as Record<string, unknown>)) {
    if (cond === undefined) continue;
    if (cond === null) {
      q = q.is(col, null);
      continue;
    }
    const op = asOp(cond);
    if (!op) {
      q = q.eq(col, cond);
      continue;
    }
    if (op.op === "in") {
      const list = op.value as unknown[];
      if (list.length === 0) return null; // matches nothing
      q = q.in(col, list);
    } else if (op.op === "neq") {
      q = op.value === null ? q.not(col, "is", null) : q.neq(col, op.value);
    } else {
      q = q[op.op](col, op.value);
    }
  }
  return q;
}

function wrap(error: { message: string; code?: string; hint?: string } | null) {
  if (!error) return;
  if (error.code === "23505") throw new StoreError(error.message, "unique");
  if (error.hint === "cycle" || /cycle/i.test(error.message)) throw new StoreError(error.message, "cycle");
  throw new StoreError(error.message, "invalid");
}

/**
 * Store backed by Supabase/PostgREST. Constructed with the service-role client
 * on the server (after the service layer has authorized the caller).
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(private client: SupabaseClient) {}

  async select<K extends TableName>(table: K, query: Query<Row<K>> = {}): Promise<Row<K>[]> {
    const out: Row<K>[] = [];
    const max = query.limit ?? Infinity;
    for (let offset = 0; out.length < max; offset += PAGE) {
      let q: Builder = this.client.from(table).select("*");
      q = applyWhere(q, query.where as Where<unknown>);
      if (q === null) return [];
      for (const [col, dir] of query.order ?? []) q = q.order(col, { ascending: dir === "asc" });
      const size = Math.min(PAGE, max - out.length);
      q = q.range(offset, offset + size - 1);
      const { data, error } = await q;
      wrap(error);
      out.push(...((data ?? []) as Row<K>[]));
      if (!data || data.length < size) break;
    }
    return out;
  }

  async first<K extends TableName>(table: K, query: Query<Row<K>> = {}): Promise<Row<K> | null> {
    const [row] = await this.select(table, { ...query, limit: 1 });
    return row ?? null;
  }

  async byId<K extends TableName>(table: K, id: string): Promise<Row<K> | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    wrap(error);
    return (data as Row<K>) ?? null;
  }

  async insert<K extends TableName>(table: K, rows: InsertRow<K> | InsertRow<K>[]): Promise<Row<K>[]> {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return [];
    const { data, error } = await this.client.from(table).insert(list as never).select("*");
    wrap(error);
    return (data ?? []) as Row<K>[];
  }

  async update<K extends TableName>(table: K, where: Where<Row<K>>, patch: Partial<Row<K>>): Promise<Row<K>[]> {
    let q: Builder = this.client.from(table).update(patch as never);
    q = applyWhere(q, where as Where<unknown>);
    if (q === null) return [];
    const { data, error } = await q.select("*");
    wrap(error);
    return (data ?? []) as Row<K>[];
  }

  async remove<K extends TableName>(table: K, where: Where<Row<K>>): Promise<number> {
    let q: Builder = this.client.from(table).delete({ count: "exact" });
    q = applyWhere(q, where as Where<unknown>);
    if (q === null) return 0;
    const { count, error } = await q;
    wrap(error);
    return count ?? 0;
  }
}
