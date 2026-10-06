import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { serverEnv } from "../env";
import { renderContext, type ParseContext } from "./context";
import { ParsedMessageSchema, type ParsedMessage } from "./schema";

let client: Anthropic | null = null;

/** Claude is used only when ANTHROPIC_API_KEY is set (server-side only — never shipped to the browser). */
export function claudeAvailable(): boolean {
  return Boolean(serverEnv.anthropicApiKey);
}

export function getClaude(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, timeout: 60_000, maxRetries: 2 });
  return client;
}

// Stable system prompt (cached). Volatile project context goes in the user turn.
const SYSTEM = `You read messages from a construction project's chat (Hebrew, sometimes mixed with English) and extract operational changes for the project manager. You never change data yourself: your output becomes a suggestion card the PM approves, edits or dismisses.

Classify the message into exactly one intent:
- "new_task": someone must do new work. If the sentence contains several sequential instructions ("X, then Y", "ואז", "אחרי זה", "ולאחר מכן"), return one task per step in order, and set depends_on_index on each later task to the index of the step it waits for. "Invite/call contractor Z" after a step means Z's actual work is the next task, assigned to Z.
- "completion_report": the sender says work is finished. Put the matching open task id in completes_task_id (only an id from the open task list; null if unsure).
- "blocker": something prevents work from starting or continuing (missing material, missing approval, no power, waiting for someone). Put a short description in blocker_text.
- "question": a question that needs an answer and changes nothing.
- "decision": a decision or agreement that should be recorded.
- "none": greetings, acknowledgements, small talk, or anything else.

For tasks:
- title: short Hebrew noun phrase in the style of the existing task titles (e.g. "יציקת קורת בטון מעל משקוף – דירה 17"), never a full sentence.
- area, contractor, trade: copy names exactly as they appear in the project lists; null when unknown. In a 1:1 chat an instruction from the PM is addressed to the other participant unless another contractor is named.
- status: "in_progress" if the work is starting now/today, "done" if reported finished, otherwise "planned".
- check_in_days: when the PM should check on it (e.g. "two days of drying" → 2); default 2 for work starting now, otherwise null.
affects: titles of existing open tasks (copied from the list) that this message most likely unblocks or holds up — use the dependency rules and the areas mentioned. Empty if none.
confidence: 0..1, how sure you are of the intent and fields.
Return only the JSON object.`;

/**
 * Parse one chat message with Claude using structured outputs. Returns null
 * if the model declined (refusal) or the output failed validation.
 */
export async function parseWithClaude(text: string, ctx: ParseContext): Promise<ParsedMessage | null> {
  const response = await getClaude().beta.messages.parse({
    model: serverEnv.anthropicModel,
    max_tokens: 4000,
    // Refusals on a safety classifier are retried server-side on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ParsedMessageSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `<project>\n${renderContext(ctx)}\n</project>\n\n<message sender="${ctx.sender.name}">\n${text}\n</message>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}
