"use client";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowDown, Clock, ExternalLink, Lock, Unlock, X } from "lucide-react";
import Link from "next/link";
import { memo, useMemo, useState } from "react";
import { STATE_HEX, StateBadge } from "@/components/tasks/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FlowStageVM } from "./types";

const W = 200;
const H = 70;

function colorOf(s: FlowStageVM) {
  if (!s.live) return s.phaseColor;
  return s.live.state === "missing" ? "#cbd5e1" : STATE_HEX[s.live.state];
}

export function FlowViews({ stages, board, editor, tab }: { stages: FlowStageVM[]; board?: React.ReactNode; editor?: React.ReactNode; tab?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = stages.find((s) => s.key === selected) ?? null;
  return (
    <Tabs defaultValue={tab && ["steps", "chart", "board", "edit"].includes(tab) ? tab : "steps"}>
      <TabsList className="flex w-full overflow-x-auto sm:w-auto sm:self-start">
        <TabsTrigger value="steps">{t.flow.tabSteps}</TabsTrigger>
        <TabsTrigger value="chart">{t.flow.tabChart}</TabsTrigger>
        {board && <TabsTrigger value="board">{t.flow.tabBoard}</TabsTrigger>}
        {editor && <TabsTrigger value="edit">{t.flow.tabEdit}</TabsTrigger>}
      </TabsList>
      {board && <TabsContent value="board">{board}</TabsContent>}
      {editor && <TabsContent value="edit">{editor}</TabsContent>}
      <TabsContent value="steps">
        <StepsView stages={stages} onSelect={setSelected} />
      </TabsContent>
      <TabsContent value="chart">
        <div className="relative h-[70dvh] rounded-lg border">
          <ReactFlowProvider>
            <Chart stages={stages} selected={selected} onSelect={setSelected} />
          </ReactFlowProvider>
          {sel && <StagePanel stage={sel} onClose={() => setSelected(null)} onSelect={setSelected} className="absolute inset-x-2 bottom-2 z-10 max-h-[65%] md:inset-x-auto md:end-2 md:top-2 md:bottom-auto md:w-80" />}
        </div>
      </TabsContent>
      {sel && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSelected(null)}>
          <StagePanel stage={sel} onClose={() => setSelected(null)} onSelect={setSelected} className="absolute inset-x-2 bottom-20 max-h-[70%]" />
        </div>
      )}
    </Tabs>
  );
}

function StepsView({ stages, onSelect }: { stages: FlowStageVM[]; onSelect: (k: string) => void }) {
  const levels = useMemo(() => {
    const m = new Map<number, FlowStageVM[]>();
    for (const s of stages) (m.get(s.level) ?? m.set(s.level, []).get(s.level)!).push(s);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [stages]);
  return (
    <ol className="flex flex-col items-stretch gap-1">
      {levels.map(([level, list], i) => (
        <li key={level} className="flex flex-col gap-1">
          {i > 0 && <ArrowDown className="mx-auto h-4 w-4 text-muted-foreground" />}
          <div className="flex items-center gap-2">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{level}</span>
            <span className="text-sm font-semibold">{t.flow.step(level)}</span>
            {list.length > 1 && <Badge variant="secondary">{t.flow.parallel}</Badge>}
          </div>
          <div className="grid gap-2 ps-9 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(s.key)}
                className="flex flex-col gap-1 rounded-lg border border-s-4 bg-card p-3 text-start transition-colors hover:bg-accent"
                style={{ borderInlineStartColor: colorOf(s) }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-snug">{s.name}</span>
                  {s.live && (s.live.state === "missing" ? <Badge variant="outline">{t.flow.missing}</Badge> : <StateBadge state={s.live.state} />)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.phaseName} · {s.trade} · {t.flow.days(s.days)}
                </span>
                {s.after.some((a) => a.lag) && (
                  <span className="flex items-center gap-1 text-xs text-amber-700">
                    <Clock className="h-3 w-3" />
                    {s.after.filter((a) => a.lag).map((a) => t.flow.wait(a.lag)).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

type N = Node<FlowStageVM & { color: string; selected: boolean; [k: string]: unknown }>;

const StageNode = memo(function StageNode({ data }: NodeProps<N>) {
  return (
    <div
      dir="rtl"
      className={cn("flex h-[70px] w-[200px] flex-col justify-center gap-0.5 rounded-lg border-2 bg-white px-2.5 text-[11px] shadow-sm", data.selected && "ring-4 ring-primary/40")}
      style={{ borderColor: data.color, background: `${data.color}1a` }}
    >
      <Handle type="target" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-slate-400" />
      <span className="flex items-center gap-1">
        <span className="num flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-800 px-1 text-[9px] font-bold text-white">{data.level}</span>
        <span className="line-clamp-2 font-semibold leading-tight text-slate-900">{data.name}</span>
      </span>
      <span className="truncate text-[10px] text-slate-500">
        {data.live ? (data.live.state === "missing" ? t.flow.missing : t.effective[data.live.state]) : data.phaseName} · {data.trade}
      </span>
      <Handle type="source" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-slate-400" />
    </div>
  );
});
const nodeTypes = { stage: StageNode };

function Chart({ stages, selected, onSelect }: { stages: FlowStageVM[]; selected: string | null; onSelect: (k: string | null) => void }) {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "RL", nodesep: 14, ranksep: 60, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const s of stages) g.setNode(s.key, { width: W, height: H });
    for (const s of stages) for (const a of s.after) g.setEdge(a.key, s.key);
    dagre.layout(g);
    const nodes: N[] = stages.map((s) => {
      const p = g.node(s.key);
      return { id: s.key, type: "stage", position: { x: p.x - W / 2, y: p.y - H / 2 }, data: { ...s, color: colorOf(s), selected: s.key === selected } };
    });
    const related = selected ? new Set([selected, ...(stages.find((s) => s.key === selected)?.after.map((a) => a.key) ?? []), ...(stages.find((s) => s.key === selected)?.opens.map((o) => o.key) ?? [])]) : null;
    const edges: Edge[] = stages.flatMap((s) =>
      s.after.map((a) => {
        const hot = related && (a.key === selected || s.key === selected);
        return {
          id: `${a.key}->${s.key}`,
          source: a.key,
          target: s.key,
          label: a.lag ? `+${a.lag}h` : undefined,
          animated: !!hot,
          style: { stroke: hot ? "hsl(var(--primary))" : "#94a3b8", strokeWidth: hot ? 2.5 : 1.2, opacity: related && !hot ? 0.25 : 1 },
        };
      }),
    );
    return { nodes, edges };
  }, [stages, selected]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      minZoom={0.15}
      fitView
      fitViewOptions={{ nodes: stages.filter((x) => x.level <= 5).map((x) => ({ id: x.key })), maxZoom: 1 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}

function StagePanel({ stage, onClose, onSelect, className }: { stage: FlowStageVM; onClose: () => void; onSelect: (k: string) => void; className?: string }) {
  return (
    <div dir="rtl" className={cn("overflow-y-auto rounded-lg border bg-background p-4 shadow-lg", className)} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs text-muted-foreground">
            {t.flow.step(stage.level)} · {stage.phaseName}
          </span>
          <h3 className="font-semibold leading-snug">{stage.name}</h3>
        </div>
        <button onClick={onClose} aria-label={t.app.close}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
      <p className="mt-1 text-xs">
        {stage.trade} · {t.flow.days(stage.days)}
      </p>
      {stage.live && (
        <div className="mt-2 flex items-center gap-2">
          {stage.live.state === "missing" ? <Badge variant="outline">{t.flow.missing}</Badge> : <StateBadge state={stage.live.state} />}
          {stage.live.contractor && <span className="text-xs text-muted-foreground">{stage.live.contractor}</span>}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-state-blocked">
          <Lock className="h-3 w-3" />
          {t.flow.requires}
        </span>
        {stage.after.length === 0 && <span className="text-sm text-muted-foreground">{t.flow.nothing}</span>}
        {stage.after.map((a) => (
          <button key={a.key} type="button" onClick={() => onSelect(a.key)} className="rounded border px-2 py-1 text-start text-sm hover:bg-accent">
            {a.name}
            {a.lag ? <span className="ms-1 text-xs text-amber-700">({t.flow.wait(a.lag)})</span> : null}
            {a.why && <span className="block text-xs text-muted-foreground">{a.why}</span>}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-state-ready">
          <Unlock className="h-3 w-3" />
          {t.flow.opens}
        </span>
        {stage.opens.length === 0 && <span className="text-sm text-muted-foreground">{t.flow.nothing}</span>}
        {stage.opens.map((o) => (
          <button key={o.key} type="button" onClick={() => onSelect(o.key)} className="rounded border px-2 py-1 text-start text-sm hover:bg-accent">
            {o.name}
          </button>
        ))}
      </div>
      {stage.live?.taskId && (
        <Button asChild size="sm" variant="outline" className="mt-3 w-full">
          <Link href={`/tasks/${stage.live.taskId}`}>
            <ExternalLink />
            {t.flow.openTask}
          </Link>
        </Button>
      )}
    </div>
  );
}
