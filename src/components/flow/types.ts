import type { EffectiveState } from "@/lib/engine/types";

export interface FlowStageVM {
  key: string;
  name: string;
  phase: string;
  phaseName: string;
  phaseColor: string;
  trade: string;
  days: number;
  level: number;
  start: number;
  description: string;
  after: Array<{ key: string; name: string; lag: number; why: string | null; building?: boolean }>;
  opens: Array<{ key: string; name: string }>;
  /** live status in the selected apartment */
  live: { state: EffectiveState | "missing" | "skip"; taskId: string | null; contractor: string | null } | null;
  /** shown as "only in garden apartments" etc. */
  when: string | null;
  /** building process: the shared part (roof, lobby…) */
  part: string | null;
}
