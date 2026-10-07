"use client";
import { Construction } from "lucide-react";
import { ActivateButton } from "@/components/setup/activate-button";
import { t } from "@/lib/i18n";

/** Shown while the project is in setup mode: contractors get no automatic messages. */
export function SetupBanner({ isPM }: { isPM: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 lg:px-6">
      <Construction className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t.setup.modeBanner}</span>
      {isPM && <ActivateButton />}
    </div>
  );
}
