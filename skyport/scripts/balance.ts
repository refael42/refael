/**
 * Balance bot: plays the game in accelerated headless simulation and prints
 * the economy curve. Usage: npm run balance -- --seed 1 [--minutes 60] [--reaction 1.5] [--quiet]
 *
 * M1 has no purchases yet, so it reports income per minute, per-flight pay,
 * punctuality and rating. Later milestones add tier times and dead zones.
 */
import { botCommands, createGame, formatBig, queueCommand, stepGame } from '../src/sim';

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : def;
}

const seed = arg('seed', 1);
const minutes = arg('minutes', 60);
const reaction = arg('reaction', 1.5);
const quiet = process.argv.includes('--quiet');

const s = createGame(seed);
const started = Date.now();
const rows: string[] = [];
let lastMoney = 0;
let lastServed = 0;
let bestJump = 0;
const STEPS_PER_MIN = 30 * 60;
for (let m = 1; m <= minutes; m++) {
  for (let i = 0; i < STEPS_PER_MIN; i++) {
    if (i % 4 === 0) for (const c of botCommands(s, { reaction })) queueCommand(s, c);
    stepGame(s);
  }
  const money = s.money.toNumber();
  const perMin = money - lastMoney;
  const served = s.stats.served - lastServed;
  if (lastMoney > 0) bestJump = Math.max(bestJump, perMin / Math.max(1, (lastMoney / (m - 1))));
  lastMoney = money;
  lastServed = s.stats.served;
  if (m <= 5 || m % 10 === 0) {
    rows.push(`min ${String(m).padStart(3)} | money ${formatBig(s.money).padStart(7)} | +${String(Math.round(perMin)).padStart(4)}/min | flights ${served} | rating ${s.rating.toFixed(2)}`);
  }
}
const st = s.stats;
const report = {
  seed,
  minutes,
  reaction,
  money: formatBig(s.money),
  served: st.served,
  perFlight: Math.round((s.money.toNumber() / Math.max(1, st.served)) * 10) / 10,
  perMinute: Math.round(s.money.toNumber() / minutes),
  onTimePct: Math.round((st.onTime / Math.max(1, st.onTime + st.late)) * 100),
  diverted: st.diverted,
  rating: Math.round(s.rating * 100) / 100,
  // M1: nothing to buy yet, so every minute is a "dead zone" by definition.
  deadZones: 'n/a until M3 (no purchases yet)',
  simSecondsPerRealSecond: Math.round((minutes * 60) / Math.max(0.001, (Date.now() - started) / 1000)),
};
if (!quiet) console.log(rows.join('\n'));
console.log(JSON.stringify(report, null, 2));
if (st.served === 0 || !Number.isFinite(s.money.toNumber())) {
  console.error('Balance check failed: nothing was served');
  process.exit(1);
}
