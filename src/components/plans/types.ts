import type { EffectiveState } from "@/lib/engine/types";

export interface PinVM {
  id: string;
  page: number;
  x: number;
  y: number;
  areaId: string | null;
  label: string | null;
}

export interface PinAreaVM {
  id: string;
  name: string;
  path: string;
  worst: EffectiveState | null;
  done: number;
  total: number;
  tasks: Array<{ id: string; title: string; state: EffectiveState; contractor: string | null; reason: string | null }>;
  messages: Array<{ id: string; conversationId: string; text: string; sender: string; at: string }>;
}
