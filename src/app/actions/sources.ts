"use server";
import * as svc from "@/lib/services/sources";
import { run } from "./_run";

export async function importChatChunkAction(input: svc.ImportChunk) {
  return run((ctx) => svc.importChatChunk(ctx, input));
}
export async function setSpeakerAction(sourceId: string, author: string, choice: { profileId: string | null; ignore?: boolean }) {
  return run((ctx) => svc.setSpeaker(ctx, sourceId, author, choice));
}
export async function deleteSourceAction(sourceId: string) {
  return run((ctx) => svc.deleteSource(ctx, sourceId));
}
