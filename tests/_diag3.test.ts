import { readFileSync, appendFileSync } from 'fs';
import { it } from 'vitest';
import { STEP_SEC } from '../src/data/sim';
import { parseSave, restoreGame } from '../src/sim/save';
import { stepGame } from '../src/sim/game/step';
import { queueCommand } from '../src/sim/game/commands';
import { CustomerState } from '../src/sim/game/types';
const S = '/tmp/claude-0/-home-user-refael/f1a8cda4-5e12-534c-acda-b737433d4608/scratchpad/';
for (const f of ['grand', 'crown']) it(f, { timeout: 120000 }, () => {
  const r = parseSave(readFileSync(S + 'store/' + f + '.json', 'utf8'));
  if (!r.ok) throw new Error(r.reason);
  const s = restoreGame(r.save, 3);
  const d0 = s.stats.delivered; const sv0 = s.stats.served; const e0 = s.stats.earned;
  let idle = 0, all = 0, cancelled = 0;
  for (let i = Math.round(300 / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    for (const e of s.events ?? []) if ((e as { kind?: number }).kind === undefined) {}
    if (i % 30 === 0) for (const st of s.staff) if (st.role === 'courier') { all++; if (!st.job || st.job.kind === 'home') idle++; }
  }
  appendFileSync(S + 'diag3b.txt', `${f} delivered=${s.stats.delivered - d0} served=${s.stats.served - sv0} earned=${s.stats.earned.sub(e0).toExponential(3)} courierIdle=${(idle / all).toFixed(2)} walkouts=${s.stats.walkouts}\n`);
});
