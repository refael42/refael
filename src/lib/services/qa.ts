/**
 * Engine 5 — project memory Q&A.
 * 1. retrieve: deterministic selection of the records relevant to the
 *    question (tasks, blockers, messages, checks) from the live graph;
 * 2. answer: Claude writes the answer from those records only, citing them
 *    as [T1] / [M2] / [B1]; without an API key a templated answer is built
 *    from the same records. Every answer lists its sources.
 */
import { claudeAvailable, getClaude } from "../ai/claude";
import { findArea, findContractors } from "../ai/heuristic";
import { similarity } from "../ai/text";
import type { Store } from "../db/store";
import type { Message, Task } from "../db/types";
import { serverEnv } from "../env";
import { fmtDate, fmtDateTime, localDate, t } from "../i18n";
import { canSeeConversation, isPM } from "./access";
import type { ProjectSession } from "./auth-types";
import { areaLabel, areaSubtree, type ProjectSnapshot } from "./snapshot";
import { contractorLabel, describeBlocking } from "./views";

export interface Source {
  ref: string;
  kind: "task" | "message" | "blocker";
  id: string;
  href: string;
  label: string;
  /** facts given to the model */
  text: string;
  /** one short line for the local answer */
  brief: string;
  /** an actionable root cause (not merely affected) */
  root?: boolean;
}

export interface Answer {
  question: string;
  answer: string;
  sources: Source[];
  engine: "claude" | "local";
}

type Kind = "blockers" | "asked" | "promised" | "before" | "general";

const RX = {
  blockers: /(תוקע|תוקעת|מעכב|מעכבת|חוסם|חוסמת|למה .*לא|מה עוצר|מחזיק|holding|blocking|stuck)/i,
  asked: /(ביקשתי|אמרתי ל|שלחתי ל|כתבתי ל|מה ביקשתי|asked|told)/i,
  promised: /(הבטחתי|לבדוק|בדקתי|אבדוק|promise|check)/i,
  before: /(לפני ש|לפני ש?אפשר|מה צריך לקרות|מה חסר כדי|להזמין את|before)/i,
};

function windowDays(q: string): number | null {
  if (/היום/.test(q)) return 1;
  if (/אתמול/.test(q)) return 2;
  if (/השבוע|שבוע/.test(q)) return 7;
  if (/החודש|חודש/.test(q)) return 30;
  return null;
}

export function classify(q: string): Kind {
  if (RX.before.test(q)) return "before";
  if (RX.promised.test(q) && /(הבטחתי|ולא|לא בדקתי|promise)/.test(q)) return "promised";
  if (RX.asked.test(q)) return "asked";
  if (RX.blockers.test(q)) return "blockers";
  return "general";
}

class Collector {
  list: Source[] = [];
  private seen = new Set<string>();
  private n = { task: 0, message: 0, blocker: 0 };
  add(kind: Source["kind"], id: string, href: string, label: string, text: string, brief: string, root = false) {
    const key = `${kind}:${id}`;
    const existing = this.list.find((x) => `${x.kind}:${x.id}` === key);
    if (existing) {
      existing.root ||= root;
      return;
    }
    if (this.list.length >= 40) return;
    this.seen.add(key);
    const prefix = kind === "task" ? "T" : kind === "message" ? "M" : "B";
    this.list.push({ ref: `${prefix}${++this.n[kind]}`, kind, id, href, label, text, brief, root });
  }
}

export async function retrieve(store: Store, s: ProjectSession, snap: ProjectSnapshot, question: string) {
  const kind = classify(question);
  const area = findArea(question, snap.areas);
  const contractors = findContractors(question, snap.contractors);
  const days = windowDays(question) ?? (kind === "asked" ? 7 : null);
  const since = days ? new Date(snap.now.getTime() - days * 86_400_000).toISOString() : null;
  const c = new Collector();
  const names = new Map(snap.profiles.map((p) => [p.id, p.full_name]));

  const taskFacts = (task: Task) => {
    const a = snap.analysis.byTask[task.id];
    const parts = [
      `"${task.title}"`,
      `אזור: ${areaLabel(snap.areaById, task.area_id) || "—"}`,
      `קבלן: ${contractorLabel(snap, task.contractor_id)}`,
      `מצב: ${t.effective[a.effective]}`,
    ];
    if (task.planned_end) parts.push(`סיום מתוכנן: ${fmtDate(task.planned_end)}`);
    if (task.check_at) parts.push(`לבדוק ב: ${fmtDateTime(task.check_at)}`);
    if (a.blockedBy.length) parts.push(`חסום ע״י: ${a.blockedBy.map((b) => { const l = describeBlocking(snap, b); return `${l.text} (אחראי: ${l.who})`; }).join("; ")}`);
    if (a.rootBlockers.length && a.effective === "blocked")
      parts.push(`שורש: ${a.rootBlockers.map((b) => { const l = describeBlocking(snap, b); return `${l.text} (אחראי: ${l.who})`; }).join("; ")}`);
    if (a.blocksTransitive) parts.push(`חוסם ${a.blocksTransitive} משימות`);
    return parts.join(" · ");
  };
  const taskBrief = (task: Task) => {
    const a = snap.analysis.byTask[task.id];
    const who = contractorLabel(snap, task.contractor_id);
    const late = a.effective !== "done" && task.planned_end && task.planned_end < localDate(snap.now) ? ` · ${t.tasks.overdue}` : "";
    return `${task.title} — ${t.effective[a.effective]} · ${who}${late}${a.blocksTransitive ? ` · חוסם ${a.blocksTransitive}` : ""}`;
  };
  const addTask = (task: Task, root = false) => c.add("task", task.id, `/tasks/${task.id}`, task.title, taskFacts(task), taskBrief(task), root);
  const addBlocker = (id: string) => {
    const b = snap.blockerById.get(id);
    if (!b) return;
    const bn = snap.analysis.bottlenecks.find((x) => x.id === id);
    c.add("blocker", b.id, `/overview#blocker-${b.id}`, b.title, `חסם חיצוני "${b.title}" · אחראי: ${b.owner_name ?? "—"} · ${b.status === "open" ? "פתוח" : "נפתר"}${b.expected_date ? ` · צפי: ${fmtDate(b.expected_date)}` : ""}${bn ? ` · חוסם ${bn.blocksTransitive} משימות` : ""}`, `${b.title} — ${b.owner_name ?? "—"}${bn ? ` · חוסם ${bn.blocksTransitive}` : ""}`, true);
  };

  // visible messages
  const [convs, parts] = await Promise.all([
    store.select("conversations", { where: { project_id: s.project.id } }),
    store.select("conversation_participants"),
  ]);
  const visible = new Set(convs.filter((cv) => canSeeConversation(s, cv, parts.filter((p) => p.conversation_id === cv.id))).map((cv) => cv.id));
  const messages = (await store.select("messages", { where: { project_id: s.project.id }, order: [["created_at", "desc"]], limit: 800 })).filter(
    (m) => visible.has(m.conversation_id) && m.kind !== "system" && m.text,
  );
  const addMessage = (m: Message) => {
    const to = parts.filter((p) => p.conversation_id === m.conversation_id && p.profile_id !== m.sender_profile_id).map((p) => names.get(p.profile_id) ?? "");
    const conv = convs.find((x) => x.id === m.conversation_id);
    c.add(
      "message",
      m.id,
      `/chat/${m.conversation_id}#m-${m.id}`,
      (m.text ?? "").slice(0, 60),
      `${fmtDateTime(m.created_at)} · ${names.get(m.sender_profile_id ?? "") ?? ""} → ${conv?.title ?? to.join(", ")}: "${m.text}"`,
      `${fmtDateTime(m.created_at)} → ${conv?.title ?? to.join(", ")}: ״${m.text}״`,
    );
  };

  const inArea = area ? areaSubtree(snap.areas, area.id) : null;
  const areaTasks = inArea ? snap.tasks.filter((x) => x.area_id && inArea.has(x.area_id)) : [];

  if (kind === "blockers") {
    const targets = inArea ? areaTasks : snap.tasks.filter((x) => snap.analysis.byTask[x.id].effective === "blocked");
    for (const task of targets.filter((x) => snap.analysis.byTask[x.id].effective !== "done")) {
      addTask(task);
      for (const r of snap.analysis.byTask[task.id].rootBlockers) {
        if (r.kind === "external") addBlocker(r.blockerId);
        else if ("taskId" in r) addTask(snap.taskById.get(r.taskId)!, true);
      }
    }
    if (!inArea)
      for (const b of snap.analysis.bottlenecks.slice(0, 6)) {
        if (b.kind === "external") addBlocker(b.id);
        else addTask(snap.taskById.get(b.id)!);
      }
    if (area) for (const m of messages.filter((m) => m.text && m.text.includes(area.name)).slice(0, 5)) addMessage(m);
  } else if (kind === "asked") {
    const pmIds = isPM(s) ? [s.profile.id] : snap.members.filter((m) => m.role === "pm").map((m) => m.profile_id);
    for (const ctr of contractors.length ? contractors : snap.contractors) {
      const prof = ctr.profile_id;
      if (!prof) continue;
      const theirConvs = new Set(parts.filter((p) => p.profile_id === prof).map((p) => p.conversation_id));
      const hits = messages.filter(
        (m) =>
          pmIds.includes(m.sender_profile_id ?? "") &&
          (!since || m.created_at >= since) &&
          (convs.find((x) => x.id === m.conversation_id)?.type === "direct" ? theirConvs.has(m.conversation_id) : m.text!.includes(ctr.name)),
      );
      for (const m of hits.reverse()) addMessage(m);
      if (contractors.length) for (const task of snap.tasks.filter((x) => x.contractor_id === ctr.id && x.created_from_message_id && hits.some((h) => h.id === x.created_from_message_id))) addTask(task);
    }
  } else if (kind === "promised") {
    const nowIso = snap.now.toISOString();
    for (const task of snap.tasks.filter((x) => x.check_at && x.check_at <= nowIso && x.status !== "done" && x.status !== "awaiting_approval")) addTask(task);
    const pmIds = snap.members.filter((m) => m.role === "pm").map((m) => m.profile_id);
    for (const m of messages.filter((m) => pmIds.includes(m.sender_profile_id ?? "") && /(תבדוק|לבדוק|אבדוק|בודק|תוודא|לוודא|אל תשכח|תשלח לי)/.test(m.text!) && (!since || m.created_at >= since)).reverse())
      addMessage(m);
  } else if (kind === "before") {
    const target = contractors[contractors.length - 1];
    const theirs = target ? snap.tasks.filter((x) => x.contractor_id === target.id && x.status !== "done") : areaTasks;
    // the contractor's open work and everything upstream of it that isn't done
    const stack = [...theirs.map((x) => x.id)];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const task = snap.taskById.get(id)!;
      if (task.status === "done") continue;
      addTask(task);
      for (const d of snap.dependencies.filter((d) => d.to_task_id === id)) {
        if (d.from_task_id) stack.push(d.from_task_id);
        else if (d.from_blocker_id && snap.blockerById.get(d.from_blocker_id)?.status === "open") addBlocker(d.from_blocker_id);
      }
    }
    if (target) {
      const prof = target.profile_id;
      for (const m of messages.filter((m) => m.text!.includes(target.name) || (prof && m.sender_profile_id === prof)).slice(0, 6)) addMessage(m);
    }
  }

  // general / top-up: keyword similarity over tasks and messages
  if (c.list.length < 4) {
    for (const task of areaTasks) addTask(task);
    const scored = snap.tasks.map((x) => ({ x, s: similarity(question, x.title) })).filter((r) => r.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, 8);
    for (const { x } of scored) addTask(x);
    const ms = messages.map((m) => ({ m, s: similarity(question, m.text!) })).filter((r) => r.s >= 0.4).sort((a, b) => b.s - a.s).slice(0, 8);
    for (const { m } of ms) addMessage(m);
    for (const ctr of contractors) for (const task of snap.tasks.filter((x) => x.contractor_id === ctr.id && x.status !== "done").slice(0, 8)) addTask(task);
  }

  return { kind, area, contractors, sources: c.list };
}

const SYSTEM = `You are the memory of a construction project. Answer the project manager's question in Hebrew, briefly and concretely (who, what, where, what must happen next), using ONLY the records provided. Cite every fact with the record reference in square brackets, e.g. [T3] or [M1]. If the records do not contain the answer, say so plainly. Do not invent tasks, people or dates.`;

function localAnswer(kind: Kind, question: string, sources: Source[], ctx: { area: string | null; contractor: string | null }): string {
  if (!sources.length) return t.ask.nothing;
  const tasks = sources.filter((x) => x.kind === "task");
  const msgs = sources.filter((x) => x.kind === "message");
  const roots = sources.filter((x) => x.root);
  const line = (x: Source) => `• ${x.brief} [${x.ref}]`;
  const lines: string[] = [];
  switch (kind) {
    case "blockers": {
      const affected = tasks.filter((x) => !x.root);
      lines.push(ctx.area ? `${ctx.area}: ${affected.length} משימות פתוחות, וזה מה שמחזיק אותן:` : "מה שמחזיק את הפרויקט כרגע:");
      lines.push(...roots.map(line));
      if (affected.length) lines.push("", "המשימות שנפגעות:", ...affected.map(line));
      break;
    }
    case "asked":
      lines.push(ctx.contractor ? `מה שביקשת מ${ctx.contractor}:` : "הבקשות שלך לקבלנים:");
      lines.push(...msgs.map(line));
      for (const s of tasks) lines.push(`  ↳ נוצרה משימה: ${s.label} [${s.ref}]`);
      break;
    case "promised":
      lines.push("בדיקות שהגיע זמנן ועדיין אין אישור ביצוע:", ...tasks.map(line));
      if (msgs.length) lines.push("", "הודעות שבהן ביקשת לבדוק / לשלוח:", ...msgs.map(line));
      break;
    case "before":
      lines.push(ctx.contractor ? `כדי ש${ctx.contractor} יוכל להתחיל:` : "תנאים מקדימים:");
      lines.push(...[...sources.filter((x) => x.kind === "blocker"), ...tasks].map(line));
      break;
    default:
      lines.push(`מה שמצאתי בפרויקט לגבי "${question}":`, ...sources.slice(0, 12).map(line));
  }
  return lines.join("\n");
}

export async function askProject(store: Store, s: ProjectSession, snap: ProjectSnapshot, question: string): Promise<Answer> {
  const q = question.trim().slice(0, 500);
  const r = await retrieve(store, s, snap, q);
  const ctx = { area: r.area?.name ?? null, contractor: r.contractors.at(-1)?.name ?? null };

  if (claudeAvailable() && r.sources.length) {
    try {
      const response = await getClaude().beta.messages.create({
        model: serverEnv.anthropicModel,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `today: ${localDate(snap.now)}\n<records>\n${r.sources.map((x) => `[${x.ref}] ${x.text}`).join("\n")}\n</records>\n\n<question>${q}</question>`,
          },
        ],
      });
      if (response.stop_reason !== "refusal") {
        const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
        if (text) {
          const cited = new Set([...text.matchAll(/\[([TMB]\d+)\]/g)].map((m) => m[1]));
          return { question: q, answer: text, sources: r.sources.filter((x) => cited.has(x.ref)), engine: "claude" };
        }
      }
    } catch (err) {
      console.warn("[qa] Claude failed, using local answer:", (err as Error).message);
    }
  }
  const answer = localAnswer(r.kind, q, r.sources, ctx);
  const cited = new Set([...answer.matchAll(/\[([TMB]\d+)\]/g)].map((m) => m[1]));
  return { question: q, answer, sources: r.sources.filter((x) => cited.has(x.ref)), engine: "local" };
}
