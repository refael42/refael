import { HardHat } from "lucide-react";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { CodeForm } from "./code-form";
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
        <p className="text-sm text-muted-foreground">{searchParams.t ? t.auth.linkHint : t.auth.codeHint}</p>
      </div>
      {searchParams.t ? (
        <>
          <LinkForm token={searchParams.t} />
          <Link href="/auth/link" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t.auth.haveCode}
          </Link>
        </>
      ) : (
        <CodeForm />
      )}
    </main>
  );
}
