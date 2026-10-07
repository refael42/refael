import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import type { ProjectSnapshot } from "@/lib/services/snapshot";
import { ActivateButton } from "./activate-button";

/** Guided setup for a new (or mid-way) project, shown on Home while in setup mode. */
export function SetupChecklist({ snap }: { snap: ProjectSnapshot }) {
  const apartments = snap.areas.filter((a) => a.type === "apartment").length;
  const contractors = snap.members.filter((m) => m.role === "contractor").length;
  const flowTasks = snap.tasks.filter((x) => x.flow_stage);
  const steps = [
    { label: t.setup.stepStructure, done: apartments > 0, href: "/settings?tab=areas", note: apartments ? `${apartments}` : null },
    { label: t.setup.stepContractors, done: contractors > 0, href: "/settings?tab=contractors", note: contractors ? `${contractors}` : null },
    { label: t.setup.stepFlow, done: flowTasks.length > 0, href: "/flow", note: null },
    { label: t.setup.stepCapture, done: flowTasks.some((x) => x.status === "done"), href: "/flow?tab=board", note: null },
  ];
  return (
    <Card className="border-amber-300 dark:border-amber-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.setup.checklistTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {steps.map((st, i) => (
          <Link key={st.label} href={st.href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
            {st.done ? <CheckCircle2 className="h-5 w-5 text-state-ready" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            <span className={st.done ? "flex-1 text-muted-foreground" : "flex-1 font-medium"}>
              {i + 1}. {st.label}
            </span>
            {st.note && <span className="num text-sm text-muted-foreground">{st.note}</span>}
          </Link>
        ))}
        <div className="flex items-center gap-3 px-2 py-2">
          <Circle className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 font-medium">5. {t.setup.stepActivate}</span>
          <ActivateButton />
        </div>
      </CardContent>
    </Card>
  );
}
