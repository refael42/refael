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
  /** last WhatsApp message from this person (opens the 24h free-text window) */
  wa_last_inbound_at: ISODateTime | null;
  wa_opt_out: boolean;
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
  /** the message arrived from WhatsApp */
  via?: "whatsapp";
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

export type PlanDiscipline = "architecture" | "structure" | "electrical" | "plumbing" | "hvac" | "fire" | "landscape" | "other";

export interface PlanFile {
  id: UUID;
  project_id: UUID;
  title: string;
  file_url: string;
  floor_area_id: UUID | null;
  created_by: UUID | null;
  created_at: ISODateTime;
  discipline: PlanDiscipline | null;
  /** sheet number from the title block ("A-101") */
  sheet: string | null;
  /** the designer's revision mark ("ג", "C", "3") */
  revision: string | null;
  /** 1, 2, 3… in this project, along the supersedes chain */
  version: number;
  /** the version this one replaced */
  supersedes_id: UUID | null;
  /** false once a newer version was uploaded */
  is_current: boolean;
  /** areas the plan covers (apartments, floors, common areas) */
  area_ids: UUID[];
  page_count: number | null;
  /** text read from the PDF (search, "what changed") */
  text_index: string | null;
  /** what the PM wrote about this version */
  change_note: string | null;
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

export interface WhatsappLink {
  id: UUID;
  profile_id: UUID;
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  access_token: string | null;
  status: "connected" | "disconnected" | "error";
  history_requested_at: ISODateTime | null;
  last_message_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface WhatsappLinkContact {
  id: UUID;
  link_id: UUID;
  /** the other side's WhatsApp number, digits only */
  wa_id: string;
  name: string | null;
  status: "pending" | "follow" | "ignore";
  project_id: UUID | null;
  source_ids: UUID[];
  message_count: number;
  last_at: ISODateTime | null;
  created_at: ISODateTime;
}

export type SourceKind = "whatsapp_export" | "whatsapp_coexistence" | "manual";
export type SourceItemKind = "text" | "image" | "voice" | "file" | "system";
export type SourceItemStatus = "new" | "processed" | "skipped" | "error";

/** One outside conversation (a WhatsApp chat export, later Coexistence). */
export interface Source {
  id: UUID;
  project_id: UUID;
  kind: SourceKind;
  title: string;
  is_group: boolean;
  /** export display name → who it is (or ignore) */
  speakers: Record<string, { profile_id: UUID | null; ignore?: boolean; auto?: boolean }>;
  since: ISODateTime | null;
  last_import_at: ISODateTime | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}

/** A message exactly as received from a source — the evidence later updates point to. */
export interface SourceItem {
  id: UUID;
  project_id: UUID;
  source_id: UUID;
  external_id: string;
  sent_at: ISODateTime;
  author: string | null;
  author_profile_id: UUID | null;
  kind: SourceItemKind;
  text: string | null;
  media_url: string | null;
  media_name: string | null;
  status: SourceItemStatus;
  created_at: ISODateTime;
}

export type EventType =
  | "reported_done"
  | "started"
  | "inspected_ok"
  | "defect"
  | "commitment"
  | "blocker"
  | "material_missing"
  | "approval_missing"
  | "instruction_change"
  | "new_task"
  | "dependency_hint";
export type EventStatus = "proposed" | "needs_info" | "applied" | "dismissed";

/** What the server matched an event to. */
export interface EventUndo {
  tasks: Array<Pick<Task, "id" | "status" | "planned_start" | "planned_end" | "started_at" | "completed_at">>;
  created_task_ids: UUID[];
  report_ids: UUID[];
  reopened_report_ids: UUID[];
  blocker_id: UUID | null;
}

export interface EventResolution {
  task_ids?: UUID[];
  area_ids?: UUID[];
  contractor_id?: UUID | null;
  trade_id?: UUID | null;
  date?: ISODate | null;
  /** tasks actually changed when applied */
  applied_task_ids?: UUID[];
  blocker_id?: UUID | null;
  /** how to take the applied change back */
  undo?: EventUndo;
}

/** One operational fact read from a message — changes nothing until the PM applies it. */
export interface ProjectEvent {
  id: UUID;
  project_id: UUID;
  source_item_id: UUID | null;
  type: EventType;
  summary: string;
  quote: string | null;
  extracted: Record<string, unknown>;
  resolved: EventResolution;
  confidence: number;
  status: EventStatus;
  note: string | null;
  decided_by: UUID | null;
  decided_at: ISODateTime | null;
  occurred_at: ISODateTime;
  created_at: ISODateTime;
}

/** A WhatsApp webhook message already handled (Meta retries deliveries). */
export interface WaInbound {
  id: string;
  from_phone: string;
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
  wa_inbound: WaInbound;
  sources: Source;
  source_items: SourceItem;
  project_events: ProjectEvent;
  whatsapp_links: WhatsappLink;
  whatsapp_link_contacts: WhatsappLinkContact;
}

export type TableName = keyof Tables;
