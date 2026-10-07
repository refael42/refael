import type { MemberRole } from "@/lib/db/types";
import { t } from "@/lib/i18n";

export type NavKey =
  | "home"
  | "my"
  | "chat"
  | "approvals"
  | "graph"
  | "overview"
  | "tasks"
  | "plans"
  | "ask"
  | "gantt"
  | "templates"
  | "notifications"
  | "settings"
  | "report"
  | "flow";

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  short?: string;
  /** shown in the mobile bottom bar */
  primary?: boolean;
}

const ALL: Record<NavKey, NavItem> = {
  home: { key: "home", href: "/", label: t.nav.home, short: t.nav.homeShort },
  my: { key: "my", href: "/my", label: t.nav.myTasks },
  chat: { key: "chat", href: "/chat", label: t.nav.chat },
  approvals: { key: "approvals", href: "/approvals", label: t.nav.approvals },
  graph: { key: "graph", href: "/graph", label: t.nav.graph },
  overview: { key: "overview", href: "/overview", label: t.nav.overview },
  tasks: { key: "tasks", href: "/tasks", label: t.nav.tasks },
  plans: { key: "plans", href: "/plans", label: t.nav.plans },
  ask: { key: "ask", href: "/ask", label: t.nav.ask },
  gantt: { key: "gantt", href: "/gantt", label: t.nav.gantt },
  templates: { key: "templates", href: "/templates", label: t.nav.templates },
  notifications: { key: "notifications", href: "/notifications", label: t.nav.notifications },
  settings: { key: "settings", href: "/settings", label: t.nav.settings },
  report: { key: "report", href: "/report", label: t.nav.report },
  flow: { key: "flow", href: "/flow", label: t.nav.flow },
};

const BY_ROLE: Record<MemberRole, { primary: NavKey[]; rest: NavKey[] }> = {
  pm: {
    primary: ["home", "chat", "approvals", "graph"],
    rest: ["flow", "overview", "report", "tasks", "plans", "ask", "gantt", "templates", "notifications", "settings"],
  },
  contractor: { primary: ["my", "chat", "notifications"], rest: [] },
  viewer: { primary: ["home", "overview", "graph", "chat"], rest: ["flow", "report", "tasks", "plans", "ask", "gantt", "notifications"] },
};

export function navFor(role: MemberRole) {
  const cfg = BY_ROLE[role];
  return {
    primary: cfg.primary.map((k) => ({ ...ALL[k], primary: true })),
    rest: cfg.rest.map((k) => ALL[k]),
  };
}
