"use client";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addMemberAction, createContractorAction, removeMemberAction, setMemberRoleAction, updateContractorAction } from "@/app/actions/settings";
import { Field, OptionSelect, type Option } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MemberRole } from "@/lib/db/types";
import { t } from "@/lib/i18n";

export interface ContractorRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  tradeId: string | null;
  trade: string | null;
  openTasks: number;
  linked: boolean | null;
}

export function ContractorsPanel({ rows, trades }: { rows: ContractorRow[]; trades: Option[] }) {
  const [editing, setEditing] = useState<ContractorRow | "new" | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing("new")}>
        <Plus />
        {t.settings.addContractor}
      </Button>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{[c.trade, c.company].filter(Boolean).join(" · ")}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs">
                {c.phone && (
                  <a href={`tel:${c.phone}`} dir="ltr" className="flex items-center gap-1 text-primary">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </a>
                )}
                {c.openTasks > 0 && <Badge variant="secondary">{t.settings.openTasks(c.openTasks)}</Badge>}
                {c.linked !== null && <Badge variant={c.linked ? "ready" : "outline"}>{c.linked ? t.settings.linked : t.settings.notLinked}</Badge>}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)} aria-label={t.settings.editContractor}>
              <Pencil />
            </Button>
          </div>
        ))}
      </div>
      {editing && <ContractorDialog row={editing === "new" ? null : editing} trades={trades} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ContractorDialog({ row, trades, onClose }: { row: ContractorRow | null; trades: Option[]; onClose: () => void }) {
  const [f, setF] = useState({ name: row?.name ?? "", phone: row?.phone ?? "", email: row?.email ?? "", company: row?.company ?? "", trade_id: row?.tradeId ?? null });
  const { call, pending } = useAction();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? t.settings.editContractor : t.settings.addContractor}</DialogTitle>
          {!row && <DialogDescription>{t.settings.inviteHint(f.name || t.roles.contractor)}</DialogDescription>}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.settings.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </Field>
          <Field label={t.tasks.trade}>
            <OptionSelect value={f.trade_id} onChange={(v) => setF({ ...f, trade_id: v })} options={trades} noneLabel={t.tasks.noTrade} />
          </Field>
          <Field label={t.settings.phone}>
            <Input dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="050-1234567" />
          </Field>
          <Field label={t.settings.email}>
            <Input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={t.settings.company}>
            <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !f.name.trim()}
            onClick={async () => {
              const ok = row ? await call(() => updateContractorAction(row.id, f), t.app.saved) : await call(() => createContractorAction(f), t.app.saved);
              if (ok !== null) onClose();
            }}
          >
            {t.app.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MemberRow {
  profileId: string;
  name: string;
  role: MemberRole;
  contact: string | null;
  isMe: boolean;
}

export function MembersPanel({ rows }: { rows: MemberRow[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", role: "viewer" as "pm" | "viewer" });
  const { call, pending } = useAction();
  const roles: Option[] = [
    { value: "pm", label: t.roles.pm },
    { value: "viewer", label: t.roles.viewer },
  ];
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus />
        {t.settings.addMember}
      </Button>
      <div className="rounded-lg border">
        {rows.map((m) => (
          <div key={m.profileId} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{m.name}</span>
              {m.contact && (
                <span dir="ltr" className="self-end text-xs text-muted-foreground">
                  {m.contact}
                </span>
              )}
            </div>
            {m.role === "contractor" || m.isMe ? (
              <Badge variant="outline">{t.roles[m.role]}</Badge>
            ) : (
              <>
                <OptionSelect className="h-8 w-32" value={m.role} onChange={(v) => v && call(() => setMemberRoleAction(m.profileId, v as MemberRole), t.app.saved)} options={roles} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={pending} onClick={() => call(() => removeMemberAction(m.profileId), t.app.saved)} aria-label={t.settings.remove}>
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settings.addMember}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.settings.name}>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label={t.settings.role}>
              <OptionSelect value={f.role} onChange={(v) => v && setF({ ...f, role: v as "pm" | "viewer" })} options={roles} />
            </Field>
            <Field label={t.settings.phone}>
              <Input dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label={t.settings.email}>
              <Input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !f.name.trim()}
              onClick={async () => {
                const ok = await call(() => addMemberAction(f), t.app.saved);
                if (ok !== null) {
                  setOpen(false);
                  setF({ name: "", phone: "", email: "", role: "viewer" });
                }
              }}
            >
              {t.app.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
