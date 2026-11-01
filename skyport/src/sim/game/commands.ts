import { clearLanding, clearTakeoff, startBoarding } from './flights';
import { pushEvent } from './events';
import { findFlight } from './state';
import { REJECT, type Command, type GameState } from './types';
import { hire } from './staff';
import { buyUpgrade, rushBuild } from './upgrades';
import { requestService } from './vehicles';

/** UI entry point: commands are applied at the start of the next step. */
export function queueCommand(s: GameState, cmd: Command): void {
  s.queue.push(cmd);
}

function reject(s: GameState, reason: number, flightId: number): void {
  const f = findFlight(s, flightId);
  pushEvent(s, 'cmdRejected', f?.x ?? 0, f?.y ?? 0, reason, 0, flightId);
}

export function applyCommand(s: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'debugAddMoney': {
      if (!Number.isFinite(cmd.amount)) return;
      s.money = s.money.add(cmd.amount);
      pushEvent(s, 'moneyChanged', 0, 0, cmd.amount);
      return;
    }
    case 'clearLanding': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      if (f.phase !== 'inbound' && f.phase !== 'holding') return reject(s, REJECT.notReady, f.id);
      if (!clearLanding(s, f)) return reject(s, f.landCleared ? REJECT.notReady : REJECT.noStand, f.id);
      return;
    }
    case 'sendFuel': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      const r = requestService(s, f, 'fuel');
      if (r === 'rejected') return reject(s, REJECT.notReady, f.id);
      if (r === 'queued') pushEvent(s, 'fuelQueued', f.x, f.y, f.id);
      return;
    }
    case 'sendBags': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      const r = requestService(s, f, 'bags');
      if (r === 'rejected') return reject(s, REJECT.notReady, f.id);
      if (r === 'queued') pushEvent(s, 'bagsQueued', f.x, f.y, f.id);
      return;
    }
    case 'buyUpgrade': {
      const code = buyUpgrade(s, String(cmd.id), Number.isFinite(cmd.count) ? cmd.count : 1);
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'rushBuild': {
      rushBuild(s);
      return;
    }
    case 'hire': {
      const code = hire(s, cmd.applicantId);
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'startBoarding': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      if (!startBoarding(s, f)) return reject(s, REJECT.notReady, f.id);
      return;
    }
    case 'clearTakeoff': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      if (!clearTakeoff(s, f)) return reject(s, REJECT.notReady, f.id);
      return;
    }
  }
}
