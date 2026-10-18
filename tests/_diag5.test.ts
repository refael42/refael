import { appendFileSync } from 'fs';
import { it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { createBot } from '../src/sim/bot';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { OrderState } from '../src/sim/game/types';
const S = '/tmp/claude-0/-home-user-refael/f1a8cda4-5e12-534c-acda-b737433d4608/scratchpad/';
it('late deliveries', { timeout: 900000 }, () => {
  const s = createGame(STAND_MAP, 1, {});
  const bot = createBot({ reaction: 1.2, helpStaff: true, buy: true });
  const out: string[] = [];
  let mark = 0;
  for (const until of [120, 170, 230]) {
    while (s.time < until * 60) { bot.act(s); stepGame(s, STEP_SEC); }
    const d0 = s.stats.delivered, sv0 = s.stats.served, w0 = s.stats.walkouts;
    let idle = 0, all = 0, queued = 0, n = 0, idleW = 0, allW = 0;
    for (let i = Math.round(300 / STEP_SEC); i > 0; i--) {
      bot.act(s); stepGame(s, STEP_SEC);
      if (i % 30 === 0) {
        for (const st of s.staff) { if (st.role === 'courier') { all++; if (!st.job || st.job.kind === 'home') idle++; } if (st.role === 'waiter') { allW++; if (!st.job || st.job.kind === 'home') idleW++; } }
        queued += s.orders.filter((o) => o.state === OrderState.Queued).length; n++;
      }
    }
    const cooks = s.staff.filter((st) => st.role === 'cook').length;
    out.push(`${until}m tier=${s.map.tier} cooks=${cooks}/${s.stoves.length} couriers=${s.staff.filter((st) => st.role === 'courier').length} delivered/5m=${s.stats.delivered - d0} served/5m=${s.stats.served - sv0} walkouts/5m=${s.stats.walkouts - w0} courierIdle=${(idle / all).toFixed(2)} waiterIdle=${(idleW / allW).toFixed(2)} queued=${(queued / n).toFixed(1)}`);
  }
  appendFileSync(S + 'diag5.txt', (process.env.TAG ?? '') + '\n' + out.join('\n') + '\n');
});
