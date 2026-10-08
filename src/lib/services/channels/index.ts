import "server-only";
import { registerMessageRelay } from "../messaging";
import { registerChannel } from "../notify";
import { relayToWhatsapp } from "../whatsapp";
import { webPushChannel } from "./web-push";

/** Register delivery channels (in-app is the notifications table itself) and the WhatsApp relay. */
export function registerDefaultChannels() {
  registerChannel(webPushChannel);
  registerMessageRelay(whatsappRelay);
}

// a stable function reference, so registering twice is a no-op
const whatsappRelay = (store: Parameters<typeof relayToWhatsapp>[0], msg: Parameters<typeof relayToWhatsapp>[1]) => relayToWhatsapp(store, msg);
