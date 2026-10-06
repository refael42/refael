# SiteFlow

A live execution graph for construction project managers, in Hebrew, RTL and mobile-first.

SiteFlow isn't a to-do app for contractors. At any moment it knows:

- **what can be executed right now**,
- **what is blocked and why** (and who has to act),
- **what each task is blocking** for everyone else,
- **what changed on site**, extracted from chat conversations.

Anything said in chat can become an action, and every action knows what it affects. **Nothing the AI produces enters the graph until the PM approves it.**

---

## Quick start (demo mode, zero setup)

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase variables set, the app runs in **demo mode**:

- an in-memory database seeded with the demo project (saved to `.data/demo-db.json` across restarts),
- a login screen where you pick a persona (PM, owner's representative, or any of the 14 contractors),
- realtime over Server-Sent Events,
- reminders running in-process once a minute,
- the local Hebrew message parser in place of Claude (unless you set `ANTHROPIC_API_KEY`).

The demo project is *מגדלי הגליל – בניין A*: 1 building, 4 floors, 20 apartments, 131 tasks, 140 dependencies, 14 contractors (Shor (metalwork), Vadim (cladding), Paz (HVAC), Ahmad (structure)…), 3 external blockers (fire consultant approval, electric company, municipal), chat history with pending AI suggestions, a pending completion report with photos, and a floor plan with pins. Every timestamp is relative to "now", so the project always looks live.

Suggested walkthrough:

1. **רפאל כהן (PM)**: the home screen shows 9 ready tasks, "complete these 3 today to unlock 15", and the blockers that need you (the fire consultant blocks 7 tasks; roof waterproofing is overdue).
2. **Chat → שור**: approve the suggestion card for *"שור, צריך לסמן את החורים בחיפוי של המרפסות ואז להזמין את ואדים"*. It creates two chained tasks, links them to the railings task, and messages both contractors.
3. **Approvals**: approve drywall in apt 9. Plaster in apt 9 is released, and Samer gets a notification plus a chat message.
4. Log in as **ניקולאי** (a contractor): "My tasks for today" → **בוצע + תמונה** on apt 10 → the task goes to *awaiting approval*.
5. **Ask the project**: "מה תוקע כרגע את דירה 17?"

Reset the demo from the login screen (**אפס נתוני הדגמה**).

## Running on Supabase

1. Create a Supabase project, or run `supabase start` for a local stack.
2. Apply the migrations in `supabase/migrations/` in order (`supabase db reset` locally, or `supabase db push`):
   - `…01_schema.sql`: tables, constraints, DB-level dependency cycle guard
   - `…02_rls_auth_realtime.sql`: row-level security, auth→profile linking, realtime publication, private `media` storage bucket
   - `…03_cron.sql`: pg_cron + pg_net scheduler helper for reminders
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`.
4. Seed the demo project and its login users: `npm run seed`. Every demo user's password is `siteflow-demo` (`pm@siteflow.demo`, `owner@siteflow.demo`, `shor@siteflow.demo`, …).
5. Phone OTP: configure an SMS provider under Supabase Auth → Phone. `supabase/config.toml` has test OTPs for local use.
6. Schedule reminders once the app is deployed:
   ```sql
   select public.siteflow_schedule_tick('https://your-app.example.com', '<CRON_SECRET>');
   ```
7. Optional: set `ANTHROPIC_API_KEY` (Claude parsing and Q&A) and VAPID keys from `npm run gen:vapid` (web push).

When a new auth user signs up, a trigger links them to an existing profile by phone or email. That's how a contractor the PM added gets access to his own tasks on first login.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: engine, services, parser, reminders, Q&A, seed, timezone |
| `npm run test:supabase` | Integration test against real Postgres + PostgREST (Supabase's REST layer): store operators, paging, error mapping, completion→release through the services, RLS with a contractor JWT. Needs a local Postgres superuser `psql` (`PSQL=...`) and a `postgrest` binary (`POSTGREST=...`) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run seed` | Seed the demo project into Supabase (idempotent, stable ids) |
| `npm run gen:plan` | Regenerate the demo floor-plan PDF |
| `npm run gen:vapid` | Generate web-push keys |

---

## Architecture

```
src/
  lib/
    engine/        Engine 1 – pure, deterministic dependency & status engine (+ tests)
    ai/            Claude parser, local Hebrew parser, strict JSON schema, name→id resolution
    services/      All business logic; every write is authorized here
      tasks.ts       tasks, dependencies, external blockers (+ auto-release)
      release.ts     recompute → release newly ready tasks → notify contractors
      rules.ts       Engine 3 – template rules → suggested dependencies, learning
      chat.ts        conversations, messages, read receipts
      ai-suggestions.ts  Engine 2 – parse → suggestion → PM approval (the only path in)
      completion.ts  done + photo → awaiting approval → approve / reject
      reminders.ts   Engine 4 – check / overdue / no-response / escalation / lag release
      notify.ts      channel dispatcher (in-app, web push; WhatsApp/SMS shape documented)
      qa.ts          Engine 5 – retrieval + cited answers
      access.ts      authorization rules (application mirror of RLS)
    db/            Store interface + Supabase and in-memory implementations
    i18n/he.ts     every user-facing string
  app/             Next.js App Router pages, server actions, API routes
  components/      UI (shadcn/ui-style primitives in components/ui)
supabase/          migrations, config
scripts/           Supabase seeder, demo plan generator
```

**One service layer, two stores.** Services are written once against a small `Store` interface (`select / first / byId / insert / update / remove`). `SupabaseStore` maps it onto PostgREST. `MemoryStore` powers demo mode and the tests, and mirrors the SQL defaults, unique keys and the cycle guard.

### Engine 1: dependency & status engine (`src/lib/engine`)

Pure TypeScript. No I/O, no AI, no clock (the caller passes `now`).

- **Effective state is computed.** A task is `ready` only if every predecessor is done, its lag has elapsed (e.g. 72h plaster drying before paint), and no open external blocker feeds it. Otherwise it's `blocked`, with the exact list of blocking items: predecessor task, external blocker, lag-until-date, or manual block.
- **Who must act.** Each blocking item names the contractor, the blocker's owner, the PM (for an approval), or "time only". **Root blockers** walk upstream to the item someone can act on now.
- **Cycles.** Tarjan SCC detection; `validateNewDependency` rejects an edge (and returns the path) before it's inserted. Postgres has a trigger guard as well.
- **Blocking counts** (direct and transitive) and a **CPM critical path** on remaining work (durations from planned dates, lags included).
- **Unlock impact** for every actionable task, and **"complete these K today"**: a greedy set selection that counts joint predecessors together.
- **Release diff** (`newlyReady`): after any change (completion, approval, blocker resolved, dependency removed, lag elapsed), the newly ready tasks are set to `ready`, audited, and their contractors notified (in-app/push plus a chat message).

### Engine 2: chat that creates operations

Each text message is parsed, after it's sent, into the strict contract `{ intent, tasks[{title, area, contractor, trade, status, check_in_days, depends_on_index}], affects[], completes_task_id, blocker_text, confidence }`:

- With `ANTHROPIC_API_KEY`: Claude (default `claude-opus-5-5`, configurable via `ANTHROPIC_MODEL`) with structured outputs, a cached system prompt, project context (areas, contractors, rules, open tasks) and server-side refusal fallback. Server-only; the key never reaches the browser.
- Without a key, or if the call fails: a deterministic Hebrew parser (`src/lib/ai/heuristic.ts`).
- Names are resolved to ids **on the server**. Model output never writes ids directly; `completes_task_id` is checked against the open-task list.

The suggestion is stored on the message and shown as an inline card. **Approve / Edit / Dismiss are PM-only, and approval is the only path into the graph.** Multi-step sentences ("X ואז Y") become chained dependencies; "affects" become edges; blockers become external blockers; a contractor's "done" asks him for a photo and leads to a completion report.

### Engine 3: templates + AI graph builder

Rules (`predecessor trade → successor trade`, optional title keywords, scope `same_area` = overlapping areas or `same_room`, lag) suggest dependencies whenever tasks are created, by hand or by AI. The PM ticks which ones to add. Every decision is stored in `rule_feedback`: a rule the PM keeps rejecting is shown unchecked ("you rejected this before"), and a trade pair the PM links by hand twice becomes a **learned** rule for the company.

### Engine 4: notifications & escalation

An idempotent tick (dedupe key per reminder) handles: promised checks (`check_at` passed with no confirmation, with a one-tap "send follow-up"), overdue actionable work (daily), contractors who haven't replied for `NO_RESPONSE_HOURS`, escalation after misses on separate days (urgent), daily alerts for external blockers holding critical-path work, and releases when drying/lag time elapses. Delivery goes through `NotificationChannel`s: the in-app center and Web Push today; WhatsApp/SMS plug in without changing callers (`services/channels/whatsapp.ts`).

### Engine 5: project memory (Q&A)

Retrieval is deterministic and comes first: the tasks and root causes for an area, what the PM asked a contractor in a time window, promised checks that weren't done, prerequisites before a contractor can start. Claude then answers **only from those records and cites them** (`[T3]`, `[M1]`, `[B1]`). Without a key, a structured local answer is built from the same records.

### Screens

Home ("what can be done now") · **construction-process flowchart** (full apartment sequence: what each stage requires and opens, live status per apartment, one-tap generation of an apartment's tasks in order) · project setup (areas, contractors, team) · bulk task creation across apartments · weekly status report (printable / PDF) · project overview · area view · dependency graph (React Flow, RTL dagre layout, filters, critical path, "why blocked" panel) · chat with AI cards · task detail (status, why blocked, predecessors/successors, history, photos, linked messages, plan pin) · approvals inbox · plans (PDF, pins → area panel) · contractor "my tasks for today" · templates/rules · read-only Gantt generated from the graph · notification center · ask the project.

## Security model

- **API keys never reach the client.** The Anthropic key, service-role key, VAPID private key and cron secret are read only in server modules (`server-only`). The browser gets only the Supabase anon key, which is public by design.
- **Row-level security** on every table (`…02_rls_auth_realtime.sql`): contractors can read only their own tasks, completion reports and the conversations they're in; dependencies, blockers and reminders are staff-only; PMs write. This was verified against Postgres: a contractor JWT sees 2 tasks, 0 dependencies, 2 conversations, and updates 0 rows.
- **The server** performs mutations with the service role **after** its own authorization (`services/access.ts`, mirroring RLS), so the engine can compute "why blocked" across the whole graph. Contractors then receive only the blocking *titles*, never the graph. Realtime subscriptions use the user's JWT, so RLS filters them; the demo SSE feed sends change signals only, filtered per viewer.
- Uploads are stored per project in a private bucket and served via `/api/files` after a membership check.

## Acceptance criteria → where it's verified

| Criterion | Implementation | Test |
|---|---|---|
| Completing a task unblocks the right successors and notifies their contractors | `release.ts`, `completion.ts` | `tasks.test.ts`, `completion.test.ts`, `reminders.test.ts` (lag) |
| Every blocked task shows exactly what blocks it and who must act | engine `blockedBy` / `rootBlockers`, `views.describeBlocking` | `engine.test.ts` |
| A two-instruction sentence → two tasks with a dependency after PM approval | `heuristic.ts` / Claude, `approveSuggestion` | `ai-suggestions.test.ts` |
| No AI output changes data without explicit PM approval | `analyzeMessage` only stores a suggestion; `approveSuggestion` is PM-only | `ai-suggestions.test.ts` |
| Full flow on a phone in Hebrew RTL | `dir="rtl"`, logical CSS properties, bottom nav, camera capture, PWA | browser-tested at 390px |
| Keys never reach the client; RLS for contractors | `server-only` modules, RLS migration, `access.ts` | `chat.test.ts`, `tasks.test.ts`, RLS checked in Postgres |

## Out of scope (designed for, not built)

- Reading DWG/IFC and auto-generating tasks from plans. Plans are PDFs with manual pins.
- WhatsApp Business integration. Implement `NotificationChannel`; inbound messages would go through the same `analyzeMessage → PM approval` path.
- Native mobile apps. The PWA is installable and has push.

## Known limitations

- **Next.js 14 is pinned as specified, but it has open security advisories that are only fixed in later majors.** Upgrade before production.
- In Supabase mode, multi-step writes (e.g. approving a chained suggestion) are separate PostgREST calls, not one transaction. The suggestion is claimed first and rolled back on failure; the DB cycle trigger still guards integrity.
- The local parser is deliberately conservative. Claude handles free-form phrasing far better.
