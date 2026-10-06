import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDemoData } from "../seed/demo";
import { MemoryStore, type MemoryData } from "./memory-store";

const DATA_DIR = join(process.cwd(), ".data");
const FILE = join(DATA_DIR, "demo-db.json");
const VERSION = 1;

type Persisted = { version: number; savedAt: string; data: MemoryData };

const g = globalThis as unknown as { __siteflowDemo?: MemoryStore };

function load(): MemoryData {
  if (process.env.SITEFLOW_DEMO_PERSIST !== "0" && existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Persisted;
      if (parsed.version === VERSION) return parsed.data;
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
