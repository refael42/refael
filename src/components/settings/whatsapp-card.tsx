import { MessageCircle } from "lucide-react";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import { whatsappConfigured } from "@/lib/whatsapp/client";

/** Server component: is WhatsApp on, and the webhook URL to give Meta. */
export function WhatsappCard() {
  const on = whatsappConfigured();
  const h = headers();
  const url = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}/api/whatsapp`;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <MessageCircle className="h-4 w-4" />
        {t.wa.title}
        <Badge variant={on ? "ready" : "outline"}>{on ? t.wa.connected : t.wa.notConnected}</Badge>
      </span>
      <span className="text-xs text-muted-foreground">{t.wa.hint}</span>
      <span className="text-xs text-muted-foreground">{t.wa.webhook}:</span>
      <code dir="ltr" className="select-all break-all rounded bg-muted px-2 py-1 text-xs">
        {url}
      </code>
    </div>
  );
}
