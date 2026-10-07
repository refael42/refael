"use client";
import { usePathname, useRouter } from "next/navigation";
import { OptionSelect, type Option } from "@/components/common/field";
import { t } from "@/lib/i18n";

export function FlowAreaSelect({ value, options, kind }: { value: string | null; options: Option[]; kind: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{kind === "building" ? t.flow.liveForBuilding : t.flow.liveFor}</span>
      <OptionSelect className="h-9 w-48" value={value} onChange={(v) => {
          const q = new URLSearchParams();
          if (kind !== "apartment") q.set("kind", kind);
          if (v) q.set("area", v);
          router.replace(q.size ? `${pathname}?${q}` : pathname);
        }} options={options} noneLabel={t.flow.noLive} />
    </div>
  );
}
