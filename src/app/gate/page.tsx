import { Lock } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { GateForm } from "./gate-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "🔒" };

export default function GatePage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-4 p-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5" />
        </div>
      </div>
      <GateForm next={searchParams.next ?? "/"} />
      <Link href="/auth/link" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t.auth.haveCode}
      </Link>
    </main>
  );
}
