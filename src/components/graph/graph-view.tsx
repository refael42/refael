"use client";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ExternalLink, Flame, Lock, UserRound, X } from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";
import { OptionSelect } from "@/components/common/field";
import { STATE_HEX } from "@/components/tasks/state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/misc";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { GraphNodeData, GraphPayload } from "./types";

const W = 210;
const H = 66;

function layout(nodes: GraphNodeData[], edges: GraphPayload["edges"]) {
  const g = new dagre.graphlib.Graph();
  // RL: predecessors on the right, flow towards the left (Hebrew reading order)
  g.setGraph({ rankdir: "RL", nodesep: 18, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: W, height: H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    pos.set(n.id, { x: p.x - W / 2, y: p.y - H / 2 });
  }
  return pos;
}

type FlowNode = Node<GraphNodeData & { dim: boolean; highlightCritical: boolean; selected: boolean }>;

const TaskNode = memo(function TaskNode({ data }: NodeProps<FlowNode>) {
  const color = data.state === "external" ? "#dc2626" : STATE_HEX[data.state];
  return (
    <div
      dir="rtl"
      className={cn(
        "flex h-[66px] w-[210px] flex-col justify-center gap-0.5 rounded-lg border-2 bg-white px-2.5 py-1.5 text-[11px] shadow-sm transition-opacity",
        data.kind === "blocker" && "border-dashed",
        data.dim && "opacity-25",
        data.selected && "ring-4 ring-primary/40",
      )}
      style={{
        borderColor: data.highlightCritical && data.critical ? "hsl(var(--state-critical))" : color,
        background: data.kind === "blocker" ? "#fef2f2" : `${color}14`,
      }}
    >
      <Handle type="target" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-slate-400" />
      <div className="flex items-center gap-1">
        {data.kind === "task" && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: data.tradeColor }} />}
        <span className="line-clamp-2 font-semibold leading-tight text-slate-900">{data.title}</span>
      </div>
      <div className="flex items-center gap-1 truncate text-[10px] text-slate-500">
        <span style={{ color }} className="font-medium">
          {data.state === "external" ? t.graph.external : t.effective[data.state]}
        </span>
        {data.contractor && <span className="truncate">· {data.contractor}</span>}
        {data.blocksTransitive > 0 && (
          <span className="ms-auto flex items-center gap-0.5">
            <Lock className="h-2.5 w-2.5" />
            {data.blocksTransitive}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-slate-400" />
    </div>
  );
});

const nodeTypes = { task: TaskNode };

export function GraphView(props: { data: GraphPayload; initialCritical: boolean; initialTask: string | null; initialArea: string | null }) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphInner({ data, initialCritical, initialTask, initialArea }: { data: GraphPayload; initialCritical: boolean; initialTask: string | null; initialArea: string | null }) {
  const [area, setArea] = useState<string | null>(initialArea);
  const [trade, setTrade] = useState<string | null>(null);
  const [contractor, setContractor] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [critical, setCritical] = useState(initialCritical);
  const [selected, setSelected] = useState<string | null>(initialTask);
  const flow = useReactFlow();

  const areaSet = useMemo(() => {
    if (!area) return null;
    const out = new Set([area]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of data.areas) if (a.parentId && out.has(a.parentId) && !out.has(a.id)) (out.add(a.id), (grew = true));
    }
    return out;
  }, [area, data.areas]);

  const { nodes, edges } = useMemo(() => {
    const match = (n: GraphNodeData) =>
      n.kind === "blocker" ||
      ((!onlyOpen || n.state !== "done") &&
        (!areaSet || (n.areaId && areaSet.has(n.areaId))) &&
        (!trade || n.tradeId === trade) &&
        (!contractor || n.contractorId === contractor));
    const primary = new Set(data.nodes.filter((n) => n.kind === "task" && match(n)).map((n) => n.id));
    // Context: direct neighbours of matches (shown dimmed) + blockers feeding them
    const context = new Set<string>();
    for (const e of data.edges) {
      if (primary.has(e.target) && !primary.has(e.source)) context.add(e.source);
      if (primary.has(e.source) && !primary.has(e.target)) context.add(e.target);
    }
    const filtered = !!(areaSet || trade || contractor);
    const visible = data.nodes.filter((n) => primary.has(n.id) || (context.has(n.id) && (filtered || n.kind === "blocker")) && (!onlyOpen || n.state !== "done"));
    const ids = new Set(visible.map((n) => n.id));
    const es = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const pos = layout(visible, es);
    const nodes: FlowNode[] = visible.map((n) => ({
      id: n.id,
      type: "task",
      position: pos.get(n.id)!,
      data: {
        ...n,
        dim: (critical && !n.critical && n.kind === "task") || (filtered && !primary.has(n.id)),
        highlightCritical: critical,
        selected: n.id === selected,
      },
    }));
    const edges: Edge[] = es.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.lag ? `+${e.lag}h` : undefined,
      animated: critical && e.critical,
      style: {
        stroke: critical && e.critical ? "hsl(var(--state-critical))" : "#94a3b8",
        strokeWidth: critical && e.critical ? 2.5 : 1.2,
        opacity: critical && !e.critical ? 0.3 : 1,
      },
    }));
    return { nodes, edges };
  }, [data, areaSet, trade, contractor, onlyOpen, critical, selected]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (initialTask && nodes.some((n) => n.id === initialTask)) flow.fitView({ nodes: [{ id: initialTask }], maxZoom: 1.2, duration: 300 });
      else flow.fitView({ padding: 0.1, duration: 300, minZoom: 0.45 });
    }, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaSet, trade, contractor, onlyOpen]);

  const sel = selected ? data.nodes.find((n) => n.id === selected) : null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <OptionSelect className="h-9 w-40" value={area} onChange={setArea} options={data.areas.map((a) => ({ value: a.id, label: a.label }))} noneLabel={`${t.tasks.area}: ${t.app.all}`} />
        <OptionSelect className="h-9 w-36" value={trade} onChange={setTrade} options={data.trades} noneLabel={`${t.tasks.trade}: ${t.app.all}`} />
        <OptionSelect className="h-9 w-36" value={contractor} onChange={setContractor} options={data.contractors} noneLabel={`${t.tasks.contractor}: ${t.app.all}`} />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={critical} onCheckedChange={setCritical} />
          <Flame className="h-4 w-4 text-state-critical" />
          {t.graph.criticalPath}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyOpen} onCheckedChange={setOnlyOpen} />
          {t.graph.onlyOpen}
        </label>
        <span className="ms-auto text-xs text-muted-foreground">{t.graph.nodes(nodes.length)}</span>
      </div>
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ minZoom: 0.45 }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" className="!hidden md:!block" nodeColor={(n) => {
            const d = n.data as GraphNodeData;
            return d.state === "external" ? "#dc2626" : STATE_HEX[d.state];
          }} />
        </ReactFlow>
        <Legend />
        {sel && (
          <div dir="rtl" className="absolute inset-x-2 bottom-2 z-10 max-h-[60%] overflow-y-auto rounded-lg border bg-background p-4 shadow-lg md:inset-x-auto md:end-2 md:top-2 md:bottom-auto md:w-80">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug">{sel.title}</h3>
              <button onClick={() => setSelected(null)} aria-label={t.app.close}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant={sel.state === "external" ? "blocked" : sel.state}>{sel.state === "external" ? t.graph.external : t.effective[sel.state]}</Badge>
              {sel.critical && <Badge variant="critical">{t.tasks.critical}</Badge>}
              <span>{sel.area}</span>
              {sel.contractor && <span>· {sel.contractor}</span>}
            </div>
            {sel.blocksTransitive > 0 && <p className="mt-2 text-sm">{t.blocking.blocksCount(sel.blocksTransitive, sel.blocksTransitive)}</p>}
            {sel.reasons.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <span className="text-xs font-semibold text-state-blocked">{t.blocking.title}</span>
                {sel.reasons.map((r, i) => (
                  <div key={i} className="rounded-md border border-state-blocked/30 bg-state-blocked/5 p-2 text-sm">
                    <div>{r.text}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UserRound className="h-3 w-3" />
                      {r.who}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sel.kind === "task" && (
              <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                <Link href={`/tasks/${sel.id}`}>
                  <ExternalLink />
                  {t.app.open}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    [t.effective.ready, STATE_HEX.ready],
    [t.effective.blocked, STATE_HEX.blocked],
    [t.effective.in_progress, STATE_HEX.in_progress],
    [t.effective.awaiting_approval, STATE_HEX.awaiting_approval],
    [t.effective.done, STATE_HEX.done],
  ];
  return (
    <div className="absolute start-2 top-2 z-10 hidden flex-col gap-1 rounded-md border bg-background/90 p-2 text-xs md:flex">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
