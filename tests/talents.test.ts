import { describe, expect, it } from 'vitest';
import { levelReward, xpNeed } from '../src/data/chef';
import { STAND_MAP } from '../src/data/maps';
import { DAILY } from '../src/data/retention';
import { SHOP_BY_ID } from '../src/data/shop';
import { STEP_SEC } from '../src/data/sim';
import { STAFF } from '../src/data/staff';
import { TALENT, talentCost, talentSlots, talentSpent } from '../src/data/talents';
import { WHEEL_SEGMENTS } from '../src/data/wheel';
import { big } from '../src/sim/big';
import { gainXp } from '../src/sim/chef';
import { openBranch } from '../src/sim/franchise';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { charmOf, qualityOf, statFactor, workRate } from '../src/sim/game/people';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { buyTalent, moraleChange, talentBlock, wageNow } from '../src/sim/game/talents';
import { CustomerState, type GameState, type Staff } from '../src/sim/game/types';
import { fire, scold } from '../src/sim/game/workers';
import { claimable } from '../src/sim/quests';
import { claimDaily } from '../src/sim/retention';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { buyShopItem } from '../src/sim/shop';
import { collectWheel } from '../src/sim/wheel';

// Talents (owner M46: "skills for the workers, speed, mood and so on, and skill points you have
// to earn, from the lucky wheel, quests and all sorts of things").

const TEAM = { roster: ['cook', 'waiter', 'washer'] as const };
const first = (s: GameState, role = 'cook'): Staff => s.staff.find((st) => st.role === role)!;

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

describe('talents', () => {
  it('a new restaurant starts with none; a level costs more than the one before', () => {
    const s = createGame(STAND_MAP, 1, TEAM);
    expect(s.talentPoints).toBe(TALENT.start);
    s.talentPoints = 3;
    const cook = first(s);
    cook.level = 3;
    queueCommand(s, { type: 'talent', staff: cook.id, talent: 'quick' });
    stepGame(s, STEP_SEC);
    expect(cook.talents?.quick).toBe(1);
    expect(s.talentPoints).toBe(3 - talentCost(0));
    expect(s.events.some((e) => e.type === Ev.Talent && e.a === cook.id && e.b === 1)).toBe(true);
    // Level 2 costs 2: there are 2 left.
    expect(buyTalent(s, cook.id, 'quick')).toBe(true);
    expect(s.talentPoints).toBe(0);
    expect(talentBlock(s, cook, 'quick')).toBe('points');
    expect(buyTalent(s, cook.id, 'quick')).toBe(false);
    expect(talentSpent(cook.talents)).toBe(3);
  });

  it('a worker holds a few levels in all (more as they level up), each talent up to its top', () => {
    const s = createGame(STAND_MAP, 2, TEAM);
    const cook = first(s);
    s.talentPoints = 1000;
    cook.level = 1;
    const slots = talentSlots(1);
    for (let k = 0; k < slots; k++) expect(buyTalent(s, cook.id, k % 2 ? 'mood' : 'fit')).toBe(true);
    expect(talentBlock(s, cook, 'quick')).toBe('slots');
    cook.level = 10;
    for (let k = 0; k < TALENT.max; k++) buyTalent(s, cook.id, 'quick');
    expect(cook.talents?.quick).toBe(TALENT.max);
    expect(talentBlock(s, cook, 'quick')).toBe('max');
    // An unknown talent, or a worker who is not there, is nothing.
    expect(buyTalent(s, cook.id, 'nope' as never)).toBe(false);
    expect(buyTalent(s, -5, 'mood')).toBe(false);
  });

  it('each talent does what it says', () => {
    const s = createGame(STAND_MAP, 3, TEAM);
    const cook = first(s);
    const waiter = first(s, 'waiter');
    const base = workRate(s, cook);
    cook.talents = { quick: 2, craft: 3, fit: 1, mood: 4, loyal: 2 };
    expect(workRate(s, cook) / base).toBeCloseTo(1 + 2 * TALENT.quick, 6);
    expect(qualityOf(cook) / statFactor(cook.stats.quality)).toBeCloseTo(1 + 3 * TALENT.craft, 6);
    waiter.talents = { charisma: 5 };
    expect(charmOf(waiter) / statFactor(waiter.stats.charm)).toBeCloseTo(1 + 5 * TALENT.charisma, 6);
    // A good mood takes the sting out of a scolding; a rise in morale is not touched.
    expect(moraleChange(cook, -0.1)).toBeCloseTo(-0.1 * (1 - 4 * TALENT.moodShield), 6);
    expect(moraleChange(cook, 0.1)).toBe(0.1);
    cook.morale = 0.8;
    scold(s, cook.id);
    expect(cook.morale).toBeCloseTo(0.8 + STAFF.morale.scold * (1 - 4 * TALENT.moodShield), 6);
    // Loyalty: a smaller wage on payday.
    expect(wageNow(cook).toNumber()).toBe(Math.ceil(cook.wage.toNumber() * (1 - 2 * TALENT.loyalWage)));
    // Fitness: energy drains slower than an ordinary worker's.
    const plain = first(s, 'washer');
    cook.energy = plain.energy = 1;
    cook.talents = { fit: 5 };
    plain.talents = undefined;
    for (let i = 0; i < 200; i++) stepGame(s, STEP_SEC);
    if (cook.energy < 1 && plain.energy < 1) expect(1 - cook.energy).toBeLessThan(1 - plain.energy);
  });

  it('at the top of loyalty a worker never quits over morale (they still do when unpaid)', () => {
    const s = createGame(STAND_MAP, 4, TEAM);
    const cook = first(s);
    cook.talents = { loyal: TALENT.max };
    cook.morale = 0;
    s.coins = big(1e9);
    s.dayTime = 1e9;
    stepGame(s, STEP_SEC);
    expect(cook.leaving).toBeFalsy();
  });

  it('firing gives every point back, a reset costs gems and gives them back too', () => {
    const s = createGame(STAND_MAP, 5, TEAM);
    const waiter = first(s, 'waiter');
    s.talentPoints = 10;
    buyTalent(s, waiter.id, 'charisma');
    buyTalent(s, waiter.id, 'charisma');
    expect(s.talentPoints).toBe(7);
    // A reset: gems for the points.
    s.gems = TALENT.resetGems;
    queueCommand(s, { type: 'talentReset', staff: waiter.id });
    stepGame(s, STEP_SEC);
    expect(s.talentPoints).toBe(10);
    expect(s.gems).toBe(0);
    expect(waiter.talents).toBeUndefined();
    // Not enough gems: nothing happens.
    buyTalent(s, waiter.id, 'mood');
    queueCommand(s, { type: 'talentReset', staff: waiter.id });
    stepGame(s, STEP_SEC);
    expect(s.talentPoints).toBe(9);
    fire(s, waiter.id);
    expect(s.talentPoints).toBe(10);
    // A trial that ends without keeping them: all back too.
    const washer = first(s, 'washer');
    washer.trial = true;
    buyTalent(s, washer.id, 'fit');
    expect(s.talentPoints).toBe(9);
    s.notices.push({ id: 999, kind: 'trial', staff: washer.id, time: s.time } as never);
    queueCommand(s, { type: 'answer', notice: 999, yes: false });
    stepGame(s, STEP_SEC);
    expect(s.talentPoints).toBe(10);
  });

  it('points come from the wheel, chef levels, the daily gift, quests and the shop', () => {
    const s = createGame(STAND_MAP, 6, TEAM);
    const seg = WHEEL_SEGMENTS.findIndex((x) => x.prize.kind === 'talent');
    expect(seg).toBe(WHEEL_SEGMENTS.length - 1);
    const prize = WHEEL_SEGMENTS[seg]!.prize as { points: number };
    let had = s.talentPoints;
    s.wheel.prize = seg;
    expect(collectWheel(s)).toBe(true);
    expect(s.talentPoints - had).toBe(prize.points);
    // The wheel's own card shows them (no toast on top).
    expect(s.events.some((e) => e.type === Ev.TalentPoints && e.a === prize.points && e.b === 1)).toBe(true);

    had = s.talentPoints;
    s.chef.xp = xpNeed(s.chef.level) - 1;
    gainXp(s, 'served');
    expect(s.chef.level).toBe(2);
    expect(s.talentPoints - had).toBe(levelReward(2).talent);
    expect(levelReward(5).talent).toBe(TALENT.points.chefChest);

    had = s.talentPoints;
    expect(claimDaily(s, '2026-10-19', '2026-10-18')).toBe(true);
    expect(s.talentPoints - had).toBe(DAILY.rewards[0]!.talent);
    expect(DAILY.rewards[6]!.talent).toBeGreaterThan(DAILY.rewards[0]!.talent);

    had = s.talentPoints;
    s.gems = 100;
    expect(buyShopItem(s, 'talent5')).toBe(true);
    const pack = SHOP_BY_ID.talent5 as { points: number; cost: number };
    expect(s.talentPoints - had).toBe(pack.points);
    expect(s.gems).toBe(100 - pack.cost);
  });

  it('a restaurant level brings points', () => {
    const s = createGame(STAND_MAP, 71, { roster: ['cook', 'waiter', 'washer'] });
    s.coins = big(1000);
    for (let i = 0; i < 3; i++) buyUpgrade(s, 'fries');
    play(s, 240);
    expect(claimable(s)).toEqual([0, 1, 2]);
    const had = s.talentPoints;
    for (const q of [0, 1, 2]) queueCommand(s, { type: 'claim', quest: q });
    stepGame(s, STEP_SEC);
    expect(s.quests.level).toBe(2);
    expect(s.talentPoints - had).toBe(TALENT.points.questLevel);
    // No card of its own: a toast says so.
    expect(s.events.some((e) => e.type === Ev.TalentPoints && e.a === TALENT.points.questLevel && e.b === 0)).toBe(true);
  });

  it('are saved (bad levels cleaned), and the points go with a new branch', () => {
    const s = createGame(STAND_MAP, 7, TEAM);
    const cook = first(s);
    s.talentPoints = 12;
    cook.talents = { quick: 3, mood: 1 };
    const data = makeSave(s, Date.now());
    const loaded = parseSave(JSON.stringify(data));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 7, Date.now());
    expect(back.talentPoints).toBe(12);
    expect(back.staff.find((st) => st.role === 'cook')!.talents).toEqual({ quick: 3, mood: 1 });

    // Junk in a save: unknown talents dropped, levels kept within the cap; no points saved (a save from before talents): the welcome.
    const odd = JSON.parse(JSON.stringify(data));
    delete odd.talentPoints;
    const idx = odd.team.findIndex((w: { role: string }) => w.role === 'cook');
    odd.team[idx].talents = { quick: 99, nope: 3, mood: -1, fit: 2.7 };
    const junk = parseSave(JSON.stringify(odd));
    expect(junk.ok).toBe(true);
    if (!junk.ok) return;
    const fixed = restoreGame(junk.save, 7, Date.now());
    expect(fixed.talentPoints).toBe(TALENT.welcome);
    expect(fixed.staff.find((st) => st.role === 'cook')!.talents).toEqual({ quick: TALENT.max, fit: 2 });

    // A new branch: a new team, and the old team's points come back.
    back.levels = { ...back.levels, building: 2 };
    back.map = { ...back.map, tier: 2 };
    const spent = back.staff.reduce((sum, st) => sum + talentSpent(st.talents), 0);
    expect(spent).toBeGreaterThan(0);
    if (openBranch(back)) {
      expect(back.talentPoints).toBe(12 + spent);
      expect(back.staff.every((st) => !st.talents)).toBe(true);
    }
  });
});
