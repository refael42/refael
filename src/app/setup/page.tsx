import { ArrowRight, HardHat } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/setup/new-project-form";
import { localDate, t } from "@/lib/i18n";
import { canCreateProject } from "@/lib/services/project";
import { getSession } from "@/lib/services/session";

export const dynamic = "force-dynamic";
export const metadata = { title: t.setup.newProjectTitle };

export default async function SetupPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!canCreateProject(s)) redirect("/login?noaccess=1");
  const needsCompany = !s.profile.organization_id && !s.project;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{t.setup.newProjectTitle}</h1>
          <p className="text-sm text-muted-foreground">{s.project ? t.setup.newProjectHint : t.setup.noProjectYet}</p>
        </div>
        {s.project && (
          <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
            {t.app.back}
          </Link>
        )}
      </div>
      <NewProjectForm needsCompany={needsCompany} today={localDate(new Date())} />
    </main>
  );
}
