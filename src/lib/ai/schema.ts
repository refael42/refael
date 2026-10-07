import { z } from "zod/v4";

/**
 * The STRICT JSON contract every parser (Claude or the local heuristic) must
 * return for a chat message. Names are free text from the model; the server
 * resolves them to ids (resolve.ts) — model output never writes ids directly
 * except completes_task_id, which is validated against the open-task list.
 */
export const ParsedTaskSchema = z.object({
  title: z.string(),
  area: z.string().nullable(),
  contractor: z.string().nullable(),
  trade: z.string().nullable(),
  status: z.enum(["planned", "in_progress", "done"]).nullable(),
  check_in_days: z.number().nullable(),
  depends_on_index: z.number().nullable(),
});

export const ParsedMessageSchema = z.object({
  intent: z.enum(["new_task", "completion_report", "blocker", "question", "decision", "none"]),
  tasks: z.array(ParsedTaskSchema),
  affects: z.array(z.string()),
  completes_task_id: z.string().nullable(),
  blocker_text: z.string().nullable(),
  confidence: z.number(),
});

export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;
