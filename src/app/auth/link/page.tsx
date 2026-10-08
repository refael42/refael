import { HardHat } from "lucide-react";
import { t } from "@/lib/i18n";
import { LinkForm } from "./link-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "SiteFlow" };

export default function LoginLinkPage({ searchParams }: { searchParams: { t?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-4 p-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold">{t.auth.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.linkHint}</p>
      </div>
      <LinkForm token={searchParams.t ?? ""} />
    </main>
  );
}
