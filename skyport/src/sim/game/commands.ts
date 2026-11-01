import { pushEvent } from './events';
import type { Command, GameState } from './types';

/** UI entry point: commands are applied at the start of the next step. */
export function queueCommand(s: GameState, cmd: Command): void {
  s.queue.push(cmd);
}

export function applyCommand(s: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'debugAddMoney': {
      if (!Number.isFinite(cmd.amount)) return;
      s.money = s.money.add(cmd.amount);
      pushEvent(s, 'moneyChanged', 0, 0, cmd.amount);
      return;
    }
  }
}
