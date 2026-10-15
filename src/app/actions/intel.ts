"use server";
import * as svc from "@/lib/services/intel";
import { run } from "./_run";

export async function processSourceAction(sourceId: string) {
  return run((ctx) => svc.processSource(ctx, sourceId));
}
export async function reprocessSourceAction(sourceId: string) {
  return run((ctx) => svc.reprocessSource(ctx, sourceId));
}
export async function markAsEventAction(itemId: string, input: Parameters<typeof svc.markAsEvent>[2]) {
  return run((ctx) => svc.markAsEvent(ctx, itemId, input));
}
export async function applyEventAction(eventId: string, taskIds?: string[]) {
  return run((ctx) => svc.applyEvent(ctx, eventId, { taskIds }));
}
export async function decideEventsAction(apply: string[], dismiss: string[]) {
  return run((ctx) => svc.decideEvents(ctx, { apply, dismiss }));
}
export async function dismissEventAction(eventId: string) {
  return run((ctx) => svc.dismissEvent(ctx, eventId));
}
