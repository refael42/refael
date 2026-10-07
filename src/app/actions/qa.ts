"use server";
import { getStore } from "@/lib/db";
import { isStaff } from "@/lib/services/access";
import { AccessError } from "@/lib/services/auth-types";
import { askProject } from "@/lib/services/qa";
import { loadSnapshot } from "@/lib/services/snapshot";
import { he } from "@/lib/i18n/he";
import { run } from "./_run";

export async function askAction(question: string) {
  return run(async ({ store, s }) => {
    if (!isStaff(s)) throw new AccessError(he.errors.forbidden, 403);
    if (!question.trim()) throw new AccessError(he.errors.invalid, 403);
    const snap = await loadSnapshot(getStore(), s.project.id);
    return askProject(store, s, snap, question);
  });
}
