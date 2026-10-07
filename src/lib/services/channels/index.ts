import "server-only";
import { registerChannel } from "../notify";
import { webPushChannel } from "./web-push";

/** Register delivery channels (in-app is the notifications table itself). */
export function registerDefaultChannels() {
  registerChannel(webPushChannel);
}
