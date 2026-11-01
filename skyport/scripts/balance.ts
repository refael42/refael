/**
 * Balance bot: plays in accelerated headless simulation (answers requests,
 * hires the first crew, buys the best-value upgrade) and prints the economy
 * curve. Usage: npm run balance -- --seed 1 [--minutes 90] [--reaction 1.5] [--quiet]
 */
import { botBuys, botCommands, botHires, createGame, eventsSince, formatBig, incomeRate, queueCommand, stepGame } from '../src/sim';

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : def;
}

const seed = arg('seed', 1);
const minutes = arg('minutes', 90);
const reaction = arg('reaction', 1.5);
const quiet = process.argv.includes('--quiet');

const s = createGame(seed);
const started = Date.now();
const rows: string[] = [];
const firsts: Record<string, number> = {};
let lastBuy = 0;
let deadZone = 0;
let deadZoneAt = 0;
let purchases = 0;
let lastEvent = 0;
let prevRate = 0;
let bestJump = 1;
let bestJumpAt = 0;
const STEPS_PER_MIN = 30 * 60;
for (let m = 1; m <= minutes; m++) {
  for (let i = 0; i < STEPS_PER_MIN; i++) {
    if (i % 4 === 0) for (const c of botCommands(s, { reaction })) queueCommand(s, c);
    if (i % 150 === 0) for (const c of [...botHires(s), ...botBuys(s)]) queueCommand(s, c);
    stepGame(s);
    for (const e of eventsSince(s, lastEvent)) {
      lastEvent = e.id;
      if (e.kind === 'upgraded' || e.kind === 'hired') {
        purchases++;
        const gap = s.time - lastBuy;
        if (gap > deadZone) {
          deadZone = gap;
          deadZoneAt = lastBuy;
        }
        lastBuy = s.time;
      }
      if (e.kind === 'buildDone') firsts[`stand/vehicle level ${e.a} built`] ??= Math.round(s.time / 60);
      if (e.kind === 'milestone') firsts[`first milestone`] ??= Math.round(s.time / 60);
    }
    if (s.standsBuilt >= 2) firsts['2 stands'] ??= Math.round(s.time / 60);
    if (s.standsBuilt >= 3) firsts['3 stands'] ??= Math.round(s.time / 60);
  }
  const rate = incomeRate(s) * 60;
  if (prevRate > 5 && rate / prevRate > bestJump) {
    bestJump = rate / prevRate;
    bestJumpAt = m;
  }
  prevRate = rate;
  if (m <= 5 || m % 10 === 0) {
    rows.push(
      `min ${String(m).padStart(3)} | money ${formatBig(s.money).padStart(6)} | ${String(Math.round(rate)).padStart(5)}/min | stands ${s.standsBuilt} | staff ${s.staff.length} | upgrades ${Object.values(s.upg).reduce((a, b) => a + b, 0)} | rating ${s.rating.toFixed(2)}`,
    );
  }
}
const st = s.stats;
const report = {
  seed,
  minutes,
  reaction,
  money: formatBig(s.money),
  incomePerMinute: Math.round(incomeRate(s) * 60),
  served: st.served,
  diverted: st.diverted,
  onTimePct: Math.round((st.onTime / Math.max(1, st.onTime + st.late)) * 100),
  rating: Math.round(s.rating * 100) / 100,
  purchases,
  longestDeadZoneMin: Math.round((deadZone / 60) * 10) / 10,
  deadZoneStartsAtMin: Math.round(deadZoneAt / 60),
  biggestIncomeJump: `x${bestJump.toFixed(2)} at min ${bestJumpAt}`,
  milestonesAtMinute: firsts,
  levels: s.upg,
  spent: formatBig(st.spent),
  wagesPaid: formatBig(st.wages),
  simSecondsPerRealSecond: Math.round((minutes * 60) / Math.max(0.001, (Date.now() - started) / 1000)),
};
if (!quiet) console.log(rows.join('\n'));
console.log(JSON.stringify(report, null, 2));
if (st.served === 0 || !Number.isFinite(s.money.toNumber())) {
  console.error('Balance check failed: nothing was served');
  process.exit(1);
}
