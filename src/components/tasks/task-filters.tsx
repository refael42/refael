"use client";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OptionSelect, type Option } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export function TaskFilters({
  areas,
  trades,
  contractors,
  showState = true,
  extra,
}: {
  areas: Option[];
  trades: Option[];
  contractors: Option[];
  showState?: boolean;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const states: Option[] = (["ready", "blocked", "in_progress", "awaiting_approval", "done"] as const).map((s) => ({
    value: s,
    label: t.effective[s],
  }));

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div className="relative col-span-2">
        <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.app.search} className="ps-9" />
      </div>
      {showState && (
        <OptionSelect value={params.get("state")} onChange={(v) => set("state", v)} options={states} noneLabel={`${t.tasks.state}: ${t.app.all}`} />
      )}
      <OptionSelect value={params.get("trade")} onChange={(v) => set("trade", v)} options={trades} noneLabel={`${t.tasks.trade}: ${t.app.all}`} />
      <OptionSelect value={params.get("area")} onChange={(v) => set("area", v)} options={areas} noneLabel={`${t.tasks.area}: ${t.app.all}`} />
      <OptionSelect
        value={params.get("contractor")}
        onChange={(v) => set("contractor", v)}
        options={contractors}
        noneLabel={`${t.tasks.contractor}: ${t.app.all}`}
      />
      {extra}
    </div>
  );
}
