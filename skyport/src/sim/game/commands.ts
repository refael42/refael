import { clearLanding, clearTakeoff, startBoarding } from './flights';
import { Big } from '../big';
import { pushEvent } from './events';
import { findFlight } from './state';
import { REJECT, type Command, type GameState } from './types';
import { answerRaise, confirmTrial, fire, hire, negotiate, spendTalent, startTrial, transfer } from './staff';
import { cleanName, moveDecor, rushTier, startTierBuild } from './tiers';
import { buyUpgrade, rushBuild } from './upgrades';
import { declineOffer, endContract, expandContract, negotiateOffer, signOffer } from './airlines';
import { requestService } from './vehicles';
import { setSupplier, urgentOrder } from './supplies';
import { setCelebPrivacy, setToday } from './incidents';

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
    case 'repair': {
      const f = findFlight(s, cmd.flightId);
      if (!f) return reject(s, REJECT.unknownFlight, cmd.flightId);
      // no van at this airport yet, or nothing to repair
      if (!s.vehicles.some((v) => v.kind === 'mech') || requestService(s, f, 'mech') === 'rejected') return reject(s, REJECT.notReady, f.id);
      return;
    }
    case 'buyUpgrade': {
      const code = buyUpgrade(s, String(cmd.id), Number.isFinite(cmd.count) ? cmd.count : 1);
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'rushBuild': {
      if (!rushBuild(s)) rushTier(s);
      return;
    }
    case 'upgradeTier': {
      const code = startTierBuild(s);
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'moveDecor': {
      const code = moveDecor(s, String(cmd.id), Number(cmd.x), Number(cmd.y));
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'signOffer':
    case 'negotiateOffer':
    case 'declineOffer':
    case 'expandContract':
    case 'endContract': {
      const code =
        cmd.type === 'signOffer'
          ? signOffer(s, Number(cmd.offerId))
          : cmd.type === 'negotiateOffer'
            ? negotiateOffer(s, Number(cmd.offerId), Number(cmd.mode) === 1 ? 1 : 0)
            : cmd.type === 'declineOffer'
              ? declineOffer(s, Number(cmd.offerId))
              : cmd.type === 'expandContract'
                ? expandContract(s, Number(cmd.airline))
                : endContract(s, Number(cmd.airline));
      if (code !== 0) pushEvent(s, 'cmdRejected', 0, 0, code, 0, 0);
      return;
    }
    case 'setSupplier':
      if (!setSupplier(s, Number(cmd.store), Number(cmd.supplier))) pushEvent(s, 'cmdRejected', 0, 0, REJECT.notReady, 0, 0);
      return;
    case 'urgentOrder':
      // refused: nothing to fill, or no money for it
      if (!urgentOrder(s, Number(cmd.store))) pushEvent(s, 'cmdRejected', 0, 0, REJECT.noMoney, 0, 0);
      return;
    case 'celebPrivacy':
      if (!setCelebPrivacy(s, Number(cmd.incident), !!cmd.private)) pushEvent(s, 'cmdRejected', 0, 0, REJECT.notReady, 0, 0);
      return;
    case 'setToday':
      setToday(s, Number(cmd.day));
      return;
    case 'claimReviews': {
      // the good reviews' bonus, all at once
      const n = Math.floor(s.reviewBonus);
      if (n <= 0) {
        pushEvent(s, 'cmdRejected', 0, 0, REJECT.notReady, 0, 0);
        return;
      }
      s.reviewBonus = 0;
      s.money = s.money.add(Big.fromNumber(n));
      s.stats.earned = s.stats.earned.add(Big.fromNumber(n));
      pushEvent(s, 'reviewBonus', 0, 0, n);
      return;
    }
    case 'setProfile': {
      s.profile = { manager: cleanName(cmd.manager), airport: cleanName(cmd.airport) };
      return;
    }
    case 'hire':
    case 'negotiate':
    case 'trial':
    case 'confirmTrial':
    case 'fire':
    case 'transfer':
    case 'talent':
    case 'answerRaise': {
      const code =
        cmd.type === 'hire'
          ? hire(s, cmd.applicantId)
          : cmd.type === 'negotiate'
            ? negotiate(s, cmd.applicantId)
            : cmd.type === 'trial'
              ? startTrial(s, cmd.applicantId)
              : cmd.type === 'confirmTrial'
                ? confirmTrial(s, cmd.staffId, !!cmd.keep)
                : cmd.type === 'fire'
                  ? fire(s, cmd.staffId)
                  : cmd.type === 'transfer'
                    ? transfer(s, cmd.staffId, Math.floor(cmd.role))
                    : cmd.type === 'talent'
                      ? spendTalent(s, cmd.staffId, Math.floor(cmd.talent))
                      : answerRaise(s, cmd.staffId, Math.floor(cmd.answer));
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
