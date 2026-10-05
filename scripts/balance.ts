import { BALANCE } from '../src/data/balance';
import { STAND_MAP } from '../src/data/maps';
import { runBalance, type BalanceReport } from '../src/sim/balance';
import { formatBig } from '../src/sim/format';

// `npm run balance [-- --minutes 60 --seed 1 --reaction 1.2]`: prints the progression timeline
// of a greedy bot and flags dead zones / inflation.

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function option(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
}

function print(r: BalanceReport): void {
  const out: string[] = [];
  out.push(`Simulated ${clock(r.seconds)} (m:ss), ${r.purchases.length} purchases`);
  out.push('');
  out.push('First purchases:');
  for (const p of r.purchases.slice(0, 15)) out.push(`  ${clock(p.time)}  ${p.item} -> lv ${p.level}  (${formatBig(p.cost)})`);
  out.push('');
  out.push('Per minute:   time   coins/min  served  walkouts  rating  bought');
  for (const s of r.samples) {
    const bought = r.purchases.filter((p) => p.time > s.time - BALANCE.sampleSeconds && p.time <= s.time).length;
    out.push(
      `             ${clock(s.time).padStart(5)}  ${formatBig(Math.round(s.perMinute)).padStart(9)}  ${String(s.served).padStart(6)}  ${String(s.walkouts).padStart(8)}  ${s.rating.toFixed(2).padStart(6)}  ${String(bought).padStart(6)}`,
    );
  }
  const levels = r.samples[r.samples.length - 1]?.levels ?? {};
  out.push('');
  out.push(`Final levels: ${Object.entries(levels).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  out.push('');
  const f = r.firsts;
  const verdict = (t: number | null, target: number) => (t === null ? 'never' : `${clock(t)} ${t <= target ? 'OK' : 'TOO SLOW'}`);
  out.push(`First upgrade:   ${verdict(f.upgrade, BALANCE.targets.firstUpgrade)} (target < ${BALANCE.targets.firstUpgrade}s)`);
  out.push(`First milestone: ${verdict(f.milestone, BALANCE.targets.firstMilestone)} (target < ${BALANCE.targets.firstMilestone / 60} min)`);
  out.push(`First new table: ${f.table === null ? 'never' : clock(f.table)}`);
  out.push(`Burger unlocked: ${f.burger === null ? 'never' : clock(f.burger)}`);
  out.push(`First hire:      ${verdict(f.hire, BALANCE.targets.firstHire)} (target < ${BALANCE.targets.firstHire / 60} min)`);
  out.push(`Bigger building: ${f.building === null ? 'never' : clock(f.building)} (target ${BALANCE.targets.firstBuilding.map((m) => m / 60).join('-')} min)`);
  out.push(`Hires: ${r.hires.map((h) => `${clock(h.time)} ${h.role}`).join(', ') || 'none'}  (team at the end: ${r.team}, quit: ${r.quits})`);
  out.push('');
  if (r.deadZones.length === 0) out.push(`Dead zones (> ${BALANCE.deadZoneSeconds}s with nothing to buy): none`);
  else {
    out.push(`DEAD ZONES (> ${BALANCE.deadZoneSeconds}s with nothing to buy):`);
    for (const z of r.deadZones) {
      const then = z.then ? `then bought ${z.then.item} lv ${z.then.level} for ${formatBig(z.then.cost)}` : 'still waiting at the end';
      out.push(`  from ${clock(z.start)} for ${Math.round(z.seconds)}s, ${then}`);
    }
  }
  out.push(r.bulkMinutes.length === 0 ? 'Upgrade flood: none' : `UPGRADE FLOOD (> ${BALANCE.bulkPerMinute}/min): ${r.bulkMinutes.map((b) => `min ${b.minute}: ${b.count}`).join(', ')}`);
  out.push(r.incomeJumps.length === 0 ? 'Income explosions: none' : `INCOME EXPLOSIONS: ${r.incomeJumps.map((j) => `${clock(j.time)} x${j.factor.toFixed(1)}`).join(', ')}`);
  console.log(out.join('\n'));
}

export function main(args: string[]): void {
  const minutes = option(args, 'minutes', 60);
  const started = Date.now();
  const report = runBalance({
    map: STAND_MAP,
    seconds: minutes * 60,
    seed: option(args, 'seed', 1),
    reaction: option(args, 'reaction', BALANCE.reactionSeconds),
  });
  print(report);
  console.log(`\n(ran in ${((Date.now() - started) / 1000).toFixed(1)}s)`);
}
