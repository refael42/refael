"use server";
import { he } from "@/lib/i18n/he";
import { ServiceError } from "@/lib/services/tasks";
import { connectWhatsapp, disconnectWhatsapp, setWhatsappContact } from "@/lib/services/wa-link";
import { cloudCoexGraph, coexConfigured } from "@/lib/whatsapp/coexistence";
import { run } from "./_run";

export async function connectWhatsappAction(input: { code: string; wabaId: string; phoneNumberId: string }) {
  return run(async (ctx) => {
    if (!coexConfigured()) throw new ServiceError(he.waLink.notConfigured);
    const link = await connectWhatsapp(ctx, cloudCoexGraph(), input);
    return { phone: link.display_phone };
  });
}
export async function disconnectWhatsappAction() {
  return run((ctx) => disconnectWhatsapp(ctx));
}
export async function setWhatsappContactAction(contactId: string, action: "follow" | "ignore", deleteKept = false) {
  return run((ctx) => setWhatsappContact(ctx, contactId, action, { deleteKept }));
}
