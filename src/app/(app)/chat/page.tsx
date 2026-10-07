import { MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n";

export const metadata = { title: t.chat.title };

export default function ChatIndex() {
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-2 text-muted-foreground lg:flex">
      <MessageCircle className="h-10 w-10" />
      <span>{t.chat.conversations}</span>
    </div>
  );
}
