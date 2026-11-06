import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { GUIDE_NOTES, NOTES_BY, type NoteKey } from '../src/data/guideNotes';
import { tierDef } from '../src/data/tiers';
import { applyStructural, Big, botCommands, createGame, DT, gameClock, parseSave, queueCommand, serializeGame, stepGame, switchTier, type GameState } from '../src/sim';
import { addedPerDay } from '../src/sim/game/airlines';
import { EDITION_DAYS, editionAt, GUIDE_PARTS, guideParts, guideScore, guideTraffic, NEW_STAR_DIAMONDS, RIGHT_PICK, rumorAt, STAR_AT, STAR_COINS, STAR_TIER, starsFor, SUSPECTS, weakParts, type GuideParts } from '../src/sim/game/guide';

/** The small airfield with stands and stores, loaded at this time (the way a save comes back). */
function airfieldAt(seed: number, time: number): GameState {
  const s0 = createGame(seed);
  switchTier(s0, 2);
  s0.upg.stand = 4;
  s0.upgRev++;
  applyStructural(s0);
  s0.money = Big.fromNumber(1e9);
  s0.tick = Math.round(time / DT);
  s0.time = s0.tick * DT;
  const r = parseSave(serializeGame(s0, 1000), 1000);
  if (!r.ok) throw new Error('load failed');
  const s = r.state;
  stockUp(s);
  s.nextIncidentAt = 1e12;
  return s;
}

/** Plays with the bot until `until` returns true (or the time is up); the bot's own guesses off unless asked. */
function playUntil(s: GameState, seconds: number, until: () => boolean = () => false, pick = false): void {
  for (let i = 0; i < 30 * seconds && !until(); i++) {
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) if (pick || c.type !== 'pickSuspect') queueCommand(s, c);
    stepGame(s);
  }
}

const all = (v: number): GuideParts => Object.fromEntries(GUIDE_PARTS.map((k) => [k, v])) as GuideParts;

describe('the Aviation Guide', () => {
  it('has a notebook line for every part and level, in both languages', () => {
    for (const k of GUIDE_PARTS)
      for (const lvl of ['good', 'fair', 'poor']) expect(NOTES_BY[`${k}.${lvl}` as NoteKey]?.length, `${k}.${lvl}`).toBeGreaterThanOrEqual(3);
    for (const k of ['pick.right', 'pick.wrong', 'pick.none'] as const) expect(NOTES_BY[k].length).toBeGreaterThanOrEqual(3);
    for (const n of GUIDE_NOTES) {
      expect(/[֐-׿]/.test(n.he), n.en).toBe(true);
      expect(n.en.length).toBeGreaterThan(5);
    }
    expect(new Set(GUIDE_NOTES.map((n) => n.en)).size).toBe(GUIDE_NOTES.length);
  });

  it('comes out every seven days at 08:00; the inspector flies the day before, late morning', () => {
    for (const n of [1, 2, 5]) {
      const c = gameClock(editionAt(n));
      expect(c.day).toBe(1 + n * EDITION_DAYS);
      expect(c.hour).toBe(8);
      const s = createGame(n * 3);
      const r = gameClock(rumorAt(s, n));
      expect(r.day).toBe(n * EDITION_DAYS);
      expect(r.hour).toBeGreaterThanOrEqual(9);
      expect(r.hour).toBeLessThan(14);
    }
  });

  it('scores: the parts weigh up to 1, stars at the thresholds, the weakest part first', () => {
    expect(guideScore(all(1))).toBeCloseTo(1, 6);
    expect(guideScore(all(0))).toBe(0);
    expect(guideScore(all(0.5), RIGHT_PICK)).toBeCloseTo(0.5 + RIGHT_PICK, 6);
    expect(starsFor(STAR_AT[1] - 0.001)).toBe(0);
    expect(starsFor(STAR_AT[1])).toBe(1);
    expect(starsFor(STAR_AT[2])).toBe(2);
    expect(starsFor(1)).toBe(3);
    // the higher stars need a bigger airport
    expect(starsFor(1, 1)).toBe(1);
    expect(starsFor(1, 2)).toBe(1);
    expect(starsFor(1, STAR_TIER[2])).toBe(2);
    expect(starsFor(1, STAR_TIER[3])).toBe(3);
    expect(starsFor(STAR_AT[1] - 0.01, 8)).toBe(0);
    const p = { ...all(0.95), cleanliness: 0.3, comfort: 0.6 };
    expect(weakParts(p)).toEqual(['cleanliness', 'comfort']);
    expect(weakParts(all(0.95))).toEqual([]);
  });

  it('a fresh week scores from what happened this week, not before', () => {
    const s = createGame(4);
    s.stats.onTime = 10;
    s.stats.late = 90;
    // a new week from here: the late planes were last week
    s.guide.base = { ...s.guide.base, onTime: 10, late: 90 };
    s.stats.onTime = 19;
    s.stats.late = 91;
    expect(guideParts(s).punctuality).toBeCloseTo(0.9, 6);
    s.stats.served = 40;
    s.stats.diverted = 4;
    expect(guideParts(s).safety).toBeLessThan(0.7);
  });

  it('an edition gives stars, coins and (for a star never had) diamonds, and starts a new week', () => {
    const s = createGame(5);
    // (an international airport: all three stars are possible)
    switchTier(s, 5);
    // (the morning of day 8: the first edition is due)
    s.tick = Math.round(editionAt(1) / DT) - 1;
    s.stats.onTime = 50;
    s.stats.served = 50;
    s.stats.pax = 400;
    s.stats.queued = 300;
    s.stats.queueSecs = 300 * 6;
    s.guide.samples = 10;
    s.guide.cleanSum = 9.5;
    s.guide.moodSum = 9;
    const money = s.money.toNumber();
    stepGame(s);
    const g = s.guide;
    expect(g.edition).toBe(1);
    expect(g.last).not.toBeNull();
    expect(g.lastScore).toBeCloseTo(guideScore(g.last as GuideParts), 6);
    expect(g.stars).toBe(starsFor(g.lastScore, s.tier));
    expect(g.stars).toBeGreaterThanOrEqual(2);
    expect(s.diamonds).toBe(g.stars * NEW_STAR_DIAMONDS);
    expect(s.money.toNumber() - money).toBeGreaterThanOrEqual(g.stars * STAR_COINS * tierDef(s.tier).pay - 1);
    // the new week starts from here
    expect(g.base.onTime).toBe(50);
    expect(g.samples).toBe(0);
    // more people want to fly to a starred airport
    expect(guideTraffic(s)).toBeGreaterThan(1);
    const busy = addedPerDay(s, 10);
    g.stars = 0;
    expect(addedPerDay(s, 10)).toBeLessThan(busy);
    g.stars = 2;
    // the next edition with the same stars: coins again, no more diamonds
    s.tick = Math.round(editionAt(2) / DT) - 1;
    s.guide.samples = 10;
    s.guide.cleanSum = 9.5;
    s.guide.moodSum = 9;
    s.stats.onTime = 100;
    s.stats.served = 100;
    const d = s.diamonds;
    const best = g.best;
    stepGame(s);
    expect(g.edition).toBe(2);
    expect(g.stars).toBeGreaterThanOrEqual(1);
    expect(s.diamonds - d).toBe(Math.max(0, g.stars - best) * NEW_STAR_DIAMONDS);
  });

  it('the inspector: a rumor, suspects among the passengers, the right pick is a bonus and the notebook says so', () => {
    const s = airfieldAt(7, rumorAt(createGame(7), 1) - 300);
    const t0 = s.time;
    expect(s.guide.edition).toBe(0);
    playUntil(s, 600, () => s.guide.visit !== null);
    const v = s.guide.visit!;
    expect(v, 'the rumor went round').not.toBeNull();
    expect(s.time - t0).toBeGreaterThan(250);
    expect(v.suspects.length).toBeGreaterThanOrEqual(3);
    expect(v.suspects.length).toBeLessThanOrEqual(SUSPECTS);
    expect(v.suspects).toContain(v.inspector);
    // every suspect is a passenger on the way out
    for (const id of v.suspects) expect(s.people.some((p) => p.id === id)).toBe(true);
    // somebody who is not a suspect: refused; the inspector: taken; a second pick: refused
    const other = s.people.find((p) => !v.suspects.includes(p.id));
    if (other) {
      queueCommand(s, { type: 'pickSuspect', person: other.id });
      stepGame(s);
      expect(v.picked).toBe(0);
    }
    queueCommand(s, { type: 'pickSuspect', person: v.inspector });
    stepGame(s);
    expect(v.picked).toBe(v.inspector);
    const second = v.suspects.find((id) => id !== v.inspector)!;
    queueCommand(s, { type: 'pickSuspect', person: second });
    stepGame(s);
    expect(v.picked).toBe(v.inspector);
    // the inspector boards and leaves: found out
    playUntil(s, 400, () => v.done);
    expect(v.done).toBe(true);
    expect(v.result).toBe(1);
    expect(s.guide.bonus).toBe(RIGHT_PICK);
    expect(s.guide.notes.length).toBe(GUIDE_PARTS.length + 1);
    expect(NOTES_BY['pick.right']).toContain(s.guide.notes[GUIDE_PARTS.length]);
    // the visit survives a save (the people do not: the inspector is gone, the pick stays)
    const back = parseSave(serializeGame(s, 2000), 2000);
    expect(back.ok && back.state.guide.visit?.result).toBe(1);
    expect(back.ok && back.state.guide.bonus).toBe(RIGHT_PICK);
    // the edition counts the bonus
    playUntil(s, 900, () => s.guide.edition > 0);
    expect(s.guide.edition).toBe(1);
    expect(s.guide.lastScore).toBeCloseTo(guideScore(s.guide.last as GuideParts, RIGHT_PICK), 6);
    expect(s.guide.visit).toBeNull();
    expect(s.guide.bonus).toBe(0);
  }, 240000);

  it('a wrong pick or none: no bonus', () => {
    const s = airfieldAt(11, rumorAt(createGame(11), 1) - 120);
    playUntil(s, 600, () => s.guide.visit !== null);
    const v = s.guide.visit!;
    expect(v).not.toBeNull();
    const wrong = v.suspects.find((id) => id !== v.inspector && s.people.some((p) => p.id === id))!;
    queueCommand(s, { type: 'pickSuspect', person: wrong });
    playUntil(s, 400, () => v.done);
    expect(v.result).toBe(2);
    expect(s.guide.bonus).toBe(0);
    expect(NOTES_BY['pick.wrong']).toContain(s.guide.notes[GUIDE_PARTS.length]);
  }, 240000);

  it('at a big airport the rumor goes round too (groups of passengers count)', () => {
    const s0 = createGame(13);
    switchTier(s0, 6);
    s0.upg.stand = 12;
    s0.upgRev++;
    applyStructural(s0);
    s0.money = Big.fromNumber(1e9);
    s0.tick = Math.round((rumorAt(s0, 1) - 150) / DT);
    s0.time = s0.tick * DT;
    const r = parseSave(serializeGame(s0, 1000), 1000);
    if (!r.ok) throw new Error('load failed');
    const s = r.state;
    stockUp(s);
    s.nextIncidentAt = 1e12;
    playUntil(s, 600, () => s.guide.visit !== null);
    expect(s.guide.visit, 'the rumor went round').not.toBeNull();
    expect(s.guide.visit!.suspects.length).toBe(SUSPECTS);
  }, 240000);

  it('an old save without the guide waits for the next edition (none due at once)', () => {
    const s = createGame(9);
    s.tick = Math.round((editionAt(3) + 100) / DT);
    s.time = s.tick * DT;
    const raw = JSON.parse(serializeGame(s, 5)) as { game: Record<string, unknown> };
    delete raw.game.guide;
    const r = parseSave(JSON.stringify(raw), 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.guide.edition).toBe(3);
    stepGame(r.state);
    expect(r.state.guide.edition).toBe(3);
    // and a saved guide comes back as it was
    r.state.guide.stars = 2;
    r.state.guide.best = 3;
    r.state.guide.notes = [1, 2, 3];
    r.state.guide.noteResult = 0;
    const again = parseSave(serializeGame(r.state, 6), 6);
    expect(again.ok && again.state.guide.stars).toBe(2);
    expect(again.ok && again.state.guide.best).toBe(3);
    expect(again.ok && again.state.guide.notes).toEqual([1, 2, 3]);
  });
});
