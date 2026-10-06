import { redirect } from "next/navigation";
import { AskBox } from "@/components/ask/ask-box";
import { t } from "@/lib/i18n";
import { isStaff } from "@/lib/services/access";
import { requireProjectSession } from "@/lib/services/session";

export const metadata = { title: t.ask.title };

export default async function AskPage({ searchParams }: { searchParams: { q?: string } }) {
  const s = await requireProjectSession();
  if (!isStaff(s)) redirect("/my");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <h1 className="text-xl font-bold">{t.ask.title}</h1>
      <AskBox initial={searchParams.q} />
    </div>
  );
}
