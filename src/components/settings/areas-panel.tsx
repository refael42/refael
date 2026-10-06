"use client";
import { ChevronDown, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createAreasAction, deleteAreaAction, renameAreaAction } from "@/app/actions/settings";
import { Field, OptionSelect } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AreaType } from "@/lib/db/types";
import { t } from "@/lib/i18n";

export interface AreaNode {
  id: string;
  name: string;
  type: AreaType;
  tasks: number;
  children: AreaNode[];
}

const CHILD_TYPES: Record<AreaType | "root", AreaType[]> = {
  root: ["building", "common"],
  building: ["floor", "common"],
  floor: ["apartment", "common", "room"],
  apartment: ["room"],
  common: ["room"],
  room: [],
};

export function AreasPanel({ tree }: { tree: AreaNode[] }) {
  const [adding, setAdding] = useState<{ parentId: string | null; parentType: AreaType | "root" } | null>(null);
  const [renaming, setRenaming] = useState<AreaNode | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding({ parentId: null, parentType: "root" })}>
        <Plus />
        {t.settings.addArea}
      </Button>
      <div className="rounded-lg border">
        {tree.map((n) => (
          <AreaRow key={n.id} node={n} depth={0} onAdd={setAdding} onRename={setRenaming} />
        ))}
      </div>
      {adding && <AddAreaDialog {...adding} onClose={() => setAdding(null)} />}
      {renaming && <RenameDialog node={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function AreaRow({
  node,
  depth,
  onAdd,
  onRename,
}: {
  node: AreaNode;
  depth: number;
  onAdd: (v: { parentId: string; parentType: AreaType }) => void;
  onRename: (n: AreaNode) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const { call, pending } = useAction();
  const canHaveChildren = CHILD_TYPES[node.type].length > 0;
  return (
    <>
      <div className="flex items-center gap-1 border-b px-2 py-1.5 last:border-b-0" style={{ paddingInlineStart: 8 + depth * 18 }}>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center text-muted-foreground"
          onClick={() => setOpen((o) => !o)}
          disabled={!node.children.length}
          aria-label={node.name}
        >
          {node.children.length ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" /> : null}
        </button>
        <span className="flex-1 text-sm font-medium">{node.name}</span>
        <Badge variant="outline" className="hidden sm:inline-flex">
          {t.settings.areaTypes[node.type]}
        </Badge>
        {node.tasks > 0 && <span className="text-xs text-muted-foreground">{t.tasks.count(node.tasks)}</span>}
        {canHaveChildren && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAdd({ parentId: node.id, parentType: node.type })} aria-label={t.settings.addChild} title={t.settings.addChild}>
            <Plus />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRename(node)} aria-label={t.settings.rename} title={t.settings.rename}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          disabled={pending}
          aria-label={t.app.delete}
          onClick={() => confirm(t.settings.deleteAreaConfirm) && call(() => deleteAreaAction(node.id), t.app.saved)}
        >
          <Trash2 />
        </Button>
      </div>
      {open && node.children.map((c) => <AreaRow key={c.id} node={c} depth={depth + 1} onAdd={onAdd} onRename={onRename} />)}
    </>
  );
}

function AddAreaDialog({ parentId, parentType, onClose }: { parentId: string | null; parentType: AreaType | "root"; onClose: () => void }) {
  const types = CHILD_TYPES[parentType];
  const [type, setType] = useState<AreaType>(types[0]);
  const [names, setNames] = useState("");
  const { call, pending } = useAction();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentId ? t.settings.addChild : t.settings.addArea}</DialogTitle>
        </DialogHeader>
        <Field label={t.settings.areaType}>
          <OptionSelect value={type} onChange={(v) => v && setType(v as AreaType)} options={types.map((x) => ({ value: x, label: t.settings.areaTypes[x] }))} />
        </Field>
        <Field label={t.settings.areaNames}>
          <Textarea value={names} onChange={(e) => setNames(e.target.value)} rows={3} placeholder={type === "apartment" ? "דירה 21-25" : type === "floor" ? "קומה 5" : ""} autoFocus />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || !names.trim()}
            onClick={async () => {
              const n = await call(() => createAreasAction({ parentId, type, names: [names] }), (k) => `${t.app.saved} (${k})`);
              if (n !== null) onClose();
            }}
          >
            {t.app.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ node, onClose }: { node: AreaNode; onClose: () => void }) {
  const [name, setName] = useState(node.name);
  const { call, pending } = useAction();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.settings.rename}</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={async () => {
              const ok = await call(() => renameAreaAction(node.id, name), t.app.saved);
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
