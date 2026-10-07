import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDemoData } from "../seed/demo";
import { emptyData, MemoryStore, type MemoryData } from "./memory-store";

const DATA_DIR = join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "demo-db.json");
const VERSION = 1;

type Persisted = { version: number; savedAt: string; data: MemoryData };

const g = globalThis as unknown as { __siteflowDemo?: MemoryStore };

function load(): MemoryData {
  if (process.env.SITEFLOW_DEMO_PERSIST !== "0" && existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Persisted;
      if (parsed.version === VERSION) return { ...emptyData(), ...parsed.data }; // tables added later start empty
    } catch {
      /* corrupt file → reseed */
    }
  }
  return buildDemoData(new Date());
}

let timer: ReturnType<typeof setTimeout> | null = null;
function persist(store: MemoryStore) {
  if (process.env.SITEFLOW_DEMO_PERSIST === "0") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const body: Persisted = { version: VERSION, savedAt: new Date().toISOString(), data: store.data };
      writeFileSync(FILE, JSON.stringify(body));
    } catch {
      /* read-only FS (e.g. serverless) → in-memory only */
    }
  }, 300);
}

/** Process-wide demo store (survives Next.js hot reloads via globalThis). */
export function getDemoStore(): MemoryStore {
  if (!g.__siteflowDemo) {
    const store = new MemoryStore(load());
    store.onChange = () => persist(store);
    g.__siteflowDemo = store;
    startDemoScheduler(store);
  }
  return g.__siteflowDemo;
}

/** Throw away all demo changes and reseed relative to "now". */
export function resetDemoStore() {
  const store = getDemoStore();
  store.data = buildDemoData(new Date());
  persist(store);
}

export const DEMO_UPLOAD_DIR = join(DATA_DIR, "uploads");

/**
 * Demo mode has no external cron: run the reminders tick in-process once a
 * minute (first run shortly after start so seeded reminders appear).
 */
function startDemoScheduler(store: MemoryStore) {
  const flag = globalThis as unknown as { __siteflowTick?: boolean };
  if (flag.__siteflowTick || process.env.NODE_ENV === "test" || process.env.SITEFLOW_DEMO_TICK === "0") return;
  flag.__siteflowTick = true;
  const tick = () =>
    import("../services/reminders")
      .then((m) => m.runTick(store, new Date(), { windowMinutes: 2 }))
      .catch((e) => console.warn("[demo tick]", e));
  setTimeout(tick, 3_000).unref?.();
  setInterval(tick, 60_000).unref?.();
}
