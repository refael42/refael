"use client";
import { usePathname, useRouter } from "next/navigation";
import { OptionSelect, type Option } from "@/components/common/field";
import { t } from "@/lib/i18n";

export function FlowAreaSelect({ value, options }: { value: string | null; options: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t.flow.liveFor}</span>
      <OptionSelect className="h-9 w-48" value={value} onChange={(v) => router.replace(v ? `${pathname}?area=${v}` : pathname)} options={options} noneLabel={t.flow.noLive} />
    </div>
  );
}
