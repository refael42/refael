import type { EffectiveState } from "@/lib/engine/types";

export interface GraphNodeData {
  id: string;
  kind: "task" | "blocker";
  title: string;
  state: EffectiveState | "external";
  critical: boolean;
  area: string;
  areaId: string | null;
  tradeId: string | null;
  tradeColor: string;
  contractor: string | null;
  contractorId: string | null;
  blocksTransitive: number;
  reasons: Array<{ text: string; who: string }>;
  [key: string]: unknown;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  lag: number;
  critical: boolean;
}

export interface GraphPayload {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  areas: Array<{ id: string; parentId: string | null; label: string }>;
  trades: Array<{ value: string; label: string }>;
  contractors: Array<{ value: string; label: string }>;
}
