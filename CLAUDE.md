# SiteFlow — notes for Claude (and whoever continues the work)

SiteFlow is a Next.js 14 + Supabase app for construction project managers, in Hebrew, RTL, mobile-first.
It keeps a live graph of the site's tasks (what can run now, what is blocked and why) and reads site
chats (WhatsApp) into updates. Pilot: "אימבר 16" / "ארבל כפר סבא".

- Production: https://siteflow-snowy-omega.vercel.app — **Vercel deploys `main` automatically.** Anything merged to `main` is live within minutes.
- Work on a branch, open a PR, run the checks below, then merge.
- Product guides (Hebrew): `docs/PILOT.he.md` (starting a real project), `docs/WHATSAPP.he.md`, `docs/WHATSAPP_COEXISTENCE.he.md`.

## Commands

```bash
npm install
npm run dev        # demo mode when no Supabase env is set: in-memory store, persona login
npm test           # vitest — must stay green
npm run typecheck
npm run lint
npm run build      # run before merging
```

## How the code is laid out

- `src/lib/db/` — `Store` interface with two implementations: `MemoryStore` (demo/tests) and `SupabaseStore`.
  Services are written once against `Store`. Query `where` takes one condition per column (`{ gte: … }`, `{ in: […] }`).
- `src/lib/db/types.ts` — every table's row type. A new column needs a migration (see below).
- `src/lib/services/*` — all business logic. Each takes a `ctx` (`{ store, s: session, now? }`);
  PM-only actions call `assertPM(ctx.s)`. Tests use `src/test/fixtures.ts` (`demoStore()`, `ctxFor("pm")`, `NOW`, `T("E14")`).
- `src/app/actions/*` — server actions, thin wrappers: `run((ctx) => svc.fn(ctx, …))`. Client components call them with `useAction()`.
- `src/lib/i18n/he.ts` — **every user-visible string** lives here (`t.*` in components, `he.*` in services).
- `src/lib/engine/` — dependency engine (ready / blocked / released).
- `src/lib/seed/demo.ts` — the demo project used by demo mode and by tests.

## Reading site messages (the "intel" pipeline) — free, local, no AI by default

`source_items` (chat messages) → `extractEvents` (`src/lib/intel/extract.ts`) → `project_events`
(`proposed` / `needs_info` / `applied` / `dismissed`) → the PM approves in "עדכונים מהשיחות" (`/updates`).

- `extract.ts`: Hebrew rules (word lists in `RX`), places (`areasIn`), trades (`tradeIn` — known words in
  `src/lib/ai/heuristic.ts` `TRADE_WORDS`, or the project's own work types by name), dates (`dateFrom`),
  reminders (`reminderFrom`), the chat's recent topic (`nextTopic`, 30 min), and which tasks an update is about (`matchTasks`, `taskOptions`).
- `learn.ts`: learns from the PM's decisions — approved/dismissed examples, the trade of tasks the PM picked,
  and caution after an undo.
- `src/lib/services/intel.ts`: `processSource`, `applyEvent` (records how to undo), `undoEvent`,
  `actOnStaffMessage` (acts by itself on clear updates the PM sends/forwards to the WhatsApp number, plus
  "בטל", "לא 15, 14", and short answers that complete the last message).
- **`src/lib/intel/exam.test.ts` is the reading exam.** When a real message is read wrong, add it there as a
  case first (and a trap case for anything that must *not* be read), then fix the rules. Keep all cases green.
- Rule of the product: chat never changes the plan silently. Unclear things wait for the PM; whatever the
  system did by itself is listed on `/updates` with an undo.

## WhatsApp

- Meta Cloud API, webhook `src/app/api/whatsapp/route.ts` → `src/lib/services/whatsapp.ts` (contractors and the PM
  writing to the SiteFlow number) and `wa-mirror.ts` (Coexistence: mirroring the PM's own WhatsApp Business chats).
- Status: inbound works. **Outbound replies are blocked by Meta** until a payment method is added to the WhatsApp
  account. Coexistence (Embedded Signup) needs Tech Provider status + business verification — not done yet.

## Database migrations

`supabase/migrations/*.sql`, applied **by hand** in the Supabase SQL editor, in order. A code change that needs a
new column must ship with a new migration file, and the migration must be run in production before (or right
when) the code is merged. Reminders depend on pg_cron + pg_net calling `/api/cron/tick` (`…03_cron.sql`).

## Rules

- Never commit secrets (Vercel holds the env vars: Supabase keys, WhatsApp token, CRON secret…), and never ask
  for them in chat. Never commit real people's data (the pilot's Excel files, phone numbers, chat exports).
- Hebrew UI, RTL. Keep comments short and in English like the surrounding code.
- No paid AI calls by default — the local reader is the default; Claude is used only if `ANTHROPIC_API_KEY` is set.
- Before merging: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Open items (as of 2026-11)

- Meta: add a payment method (WhatsApp replies), later business verification / Tech Provider (Coexistence).
- Confirm pg_cron is active in production (reminders).
- Deferred by the product owner: calendar/meetings from chats, leads for developers/sales, order and meeting event types.
