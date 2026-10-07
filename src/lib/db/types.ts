/**
 * Row types — mirror supabase/migrations/0001_schema.sql exactly.
 * Both data stores (Supabase and the in-memory demo store) speak these shapes.
 */

export type UUID = string;
/** 'YYYY-MM-DD' */
export type ISODate = string;
/** ISO-8601 timestamp */
export type ISODateTime = string;

export type MemberRole = "pm" | "contractor" | "viewer";
export type AreaType = "building" | "floor" | "apartment" | "room" | "common";
export type TaskStatus =
  | "planned"
  | "ready"
  | "in_progress"
  | "awaiting_approval"
  | "done"
  | "blocked_manual";
export type DependencyType = "finish_to_start" | "finish_plus_lag";
export type DependencySource = "manual" | "template" | "ai" | "learned" | "import";
export type BlockerStatus = "open" | "resolved";
export type RuleScope = "same_area" | "same_room";
export type RuleSource = "system" | "custom" | "learned";
export type RuleDecision = "accepted" | "rejected" | "added";
export type ConversationType = "direct" | "group";
export type MessageKind = "text" | "image" | "voice" | "file" | "system";
export type AiStatus = "none" | "suggested" | "accepted" | "dismissed";
export type ReportStatus = "pending" | "approved" | "rejected";
export type ReminderKind = "check" | "overdue" | "no_response" | "escalation" | "critical_blocker" | "digest";
export type ReminderStatus = "pending" | "sent" | "resolved" | "dismissed";
export type ChangeSource = "manual" | "chat" | "ai" | "system";

export interface Organization {
  id: UUID;
  name: string;
  created_at: ISODateTime;
}

export interface Profile {
  id: UUID;
  auth_user_id: UUID | null;
  organization_id: UUID | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: ISODateTime;
}

export interface Project {
  id: UUID;
  organization_id: UUID;
  name: string;
  address: string | null;
  start_date: ISODate | null;
  target_date: ISODate | null;
  /** while true contractors get no automatic messages and reminders are paused */
  setup_mode: boolean;
  created_at: ISODateTime;
}

export interface ProjectMember {
  project_id: UUID;
  profile_id: UUID;
  role: MemberRole;
  created_at: ISODateTime;
}

export interface Area {
  id: UUID;
  project_id: UUID;
  parent_id: UUID | null;
  type: AreaType;
  name: string;
  sort_order: number;
  /** apartment: "garden" | "duplex"; building: "parking" | "elevator" | "sprinklers"; common: its part ("roof", "lobby", …) */
  features: string[];
  created_at: ISODateTime;
}

export interface Trade {
  id: UUID;
  key: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Contractor {
  id: UUID;
  organization_id: UUID;
  profile_id: UUID | null;
  name: string;
  phone: string | null;
  trade_id: UUID | null;
  company: string | null;
  created_at: ISODateTime;
}

export interface Task {
  id: UUID;
  project_id: UUID;
  area_id: UUID | null;
  trade_id: UUID | null;
  contractor_id: UUID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  is_critical: boolean;
  planned_start: ISODate | null;
  planned_end: ISODate | null;
  check_at: ISODateTime | null;
  started_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  blocked_reason: string | null;
  created_from_message_id: UUID | null;
  plan_pin_id: UUID | null;
  /** stage key in the master construction process, when generated from it */
  flow_stage: string | null;
  /** where an imported task came from ("<sheet>#<number>"), for re-import */
  external_ref: string | null;
  created_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Dependency {
  id: UUID;
  project_id: UUID;
  from_task_id: UUID | null;
  from_blocker_id: UUID | null;
  to_task_id: UUID;
  type: DependencyType;
  lag_hours: number;
  source: DependencySource;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface ExternalBlocker {
  id: UUID;
  project_id: UUID;
  title: string;
  owner_name: string | null;
  owner_phone: string | null;
  status: BlockerStatus;
  notes: string | null;
  expected_date: ISODate | null;
  resolved_at: ISODateTime | null;
  created_from_message_id: UUID | null;
  created_at: ISODateTime;
}

export interface Rule {
  id: UUID;
  organization_id: UUID | null;
  name: string;
  predecessor_trade_id: UUID;
  successor_trade_id: UUID;
  predecessor_keyword: string | null;
  successor_keyword: string | null;
  scope: RuleScope;
  lag_hours: number;
  active: boolean;
  source: RuleSource;
  created_at: ISODateTime;
}

export interface RuleFeedback {
  id: UUID;
  organization_id: UUID;
  rule_id: UUID | null;
  predecessor_trade_id: UUID;
  successor_trade_id: UUID;
  decision: RuleDecision;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface Conversation {
  id: UUID;
  project_id: UUID;
  type: ConversationType;
  title: string | null;
  created_at: ISODateTime;
  last_message_at: ISODateTime | null;
}

export interface ConversationParticipant {
  conversation_id: UUID;
  profile_id: UUID;
  last_read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  project_id: UUID;
  sender_profile_id: UUID | null;
  kind: MessageKind;
  text: string | null;
  media_url: string | null;
  reply_to_id: UUID | null;
  ai_parsed_json: AiParsedJson | null;
  ai_status: AiStatus;
  ai_reviewed_by: UUID | null;
  ai_reviewed_at: ISODateTime | null;
  /** System messages carry structured actions (e.g. "upload a photo for task X"). */
  meta: MessageMeta | null;
  created_at: ISODateTime;
}

export interface MessageMeta {
  action?: "request_photo" | "task_released" | "follow_up" | "report_rejected" | "digest";
  task_id?: UUID;
  [key: string]: unknown;
}

/** Stored on messages.ai_parsed_json — see src/lib/ai/schema.ts for the model-facing schema. */
export interface AiParsedJson {
  intent: "new_task" | "completion_report" | "blocker" | "question" | "decision" | "none";
  tasks: Array<{
    title: string;
    area: string | null;
    contractor: string | null;
    trade: string | null;
    status: "planned" | "in_progress" | "done" | null;
    check_in_days: number | null;
    depends_on_index: number | null;
  }>;
  affects: string[];
  completes_task_id: UUID | null;
  blocker_text: string | null;
  confidence: number;
  /** Server-side resolution of names → ids (never trusted from the model). */
  resolved?: {
    tasks: Array<{ area_id: UUID | null; contractor_id: UUID | null; trade_id: UUID | null }>;
    affects_task_ids: UUID[];
    completes_task_id: UUID | null;
  };
  engine?: "claude" | "heuristic";
  model?: string;
  /** What actually got created when the PM approved. */
  applied?: {
    task_ids?: UUID[];
    dependency_ids?: UUID[];
    blocker_id?: UUID;
    report_id?: UUID;
  };
}

export interface MessageLink {
  message_id: UUID;
  task_id: UUID;
  kind: "created" | "completion" | "mention" | "blocker";
  created_at: ISODateTime;
}

export interface CompletionReport {
  id: UUID;
  task_id: UUID;
  contractor_id: UUID | null;
  submitted_by: UUID | null;
  photo_urls: string[];
  note: string | null;
  status: ReportStatus;
  reviewed_by: UUID | null;
  review_comment: string | null;
  reviewed_at: ISODateTime | null;
  message_id: UUID | null;
  created_at: ISODateTime;
}

export interface PlanFile {
  id: UUID;
  project_id: UUID;
  title: string;
  file_url: string;
  floor_area_id: UUID | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface PlanPin {
  id: UUID;
  plan_file_id: UUID;
  page: number;
  /** normalised 0..1 from the left edge of the page */
  x: number;
  /** normalised 0..1 from the top edge of the page */
  y: number;
  area_id: UUID | null;
  label: string | null;
  created_at: ISODateTime;
}

export interface Reminder {
  id: UUID;
  project_id: UUID;
  task_id: UUID | null;
  message_id: UUID | null;
  blocker_id: UUID | null;
  kind: ReminderKind;
  due_at: ISODateTime;
  sent_at: ISODateTime | null;
  status: ReminderStatus;
  target_profile_id: UUID | null;
  dedupe_key: string;
  created_at: ISODateTime;
}

export interface NotificationRow {
  id: UUID;
  profile_id: UUID;
  project_id: UUID | null;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  /** One-tap action, e.g. { type: "send_follow_up", conversation_id, text } */
  action: NotificationAction | null;
  urgent: boolean;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export type NotificationAction =
  | { type: "send_follow_up"; conversation_id: UUID; text: string; task_id?: UUID }
  | { type: "open"; href: string };

export interface PushSubscriptionRow {
  id: UUID;
  profile_id: UUID;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: ISODateTime;
}

export interface AuditEntry {
  id: UUID;
  project_id: UUID | null;
  entity_type: "task" | "dependency" | "blocker" | "report" | "message" | "rule" | "plan" | "project";
  entity_id: UUID;
  action: string;
  from_value: string | null;
  to_value: string | null;
  actor_profile_id: UUID | null;
  source: ChangeSource;
  meta: Record<string, unknown> | null;
  created_at: ISODateTime;
}

export interface FlowTemplate {
  organization_id: UUID;
  kind: import("../flow/process").FlowKind;
  /** FlowStage[] — see src/lib/flow/process.ts */
  stages: import("../flow/process").FlowStage[];
  updated_by: UUID | null;
  updated_at: ISODateTime;
}

export interface Tables {
  organizations: Organization;
  profiles: Profile;
  projects: Project;
  project_members: ProjectMember;
  areas: Area;
  trades: Trade;
  contractors: Contractor;
  tasks: Task;
  dependencies: Dependency;
  external_blockers: ExternalBlocker;
  rules: Rule;
  rule_feedback: RuleFeedback;
  conversations: Conversation;
  conversation_participants: ConversationParticipant;
  messages: Message;
  message_links: MessageLink;
  completion_reports: CompletionReport;
  plan_files: PlanFile;
  plan_pins: PlanPin;
  reminders: Reminder;
  notifications: NotificationRow;
  push_subscriptions: PushSubscriptionRow;
  audit_log: AuditEntry;
  flow_templates: FlowTemplate;
}

export type TableName = keyof Tables;
