"use client";
// Completed in phase 5 (AI suggestion cards).
import type { TaskFormOptions } from "@/components/tasks/task-form-dialog";
import type { AiParsedJson, AiStatus } from "@/lib/db/types";

export function AiCard(_props: {
  messageId: string;
  ai: AiParsedJson;
  status: AiStatus;
  mine: boolean;
  isPM: boolean;
  options: TaskFormOptions | null;
  taskOptions: Array<{ value: string; label: string }>;
}) {
  return null;
}
