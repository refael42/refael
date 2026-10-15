"use server";
import * as svc from "@/lib/services/intel";
import { run } from "./_run";

export async function processSourceAction(sourceId: string) {
  return run((ctx) => svc.processSource(ctx, sourceId));
}
export async function applyEventAction(eventId: string, taskIds?: string[]) {
  return run((ctx) => svc.applyEvent(ctx, eventId, { taskIds }));
}
export async function dismissEventAction(eventId: string) {
  return run((ctx) => svc.dismissEvent(ctx, eventId));
}
