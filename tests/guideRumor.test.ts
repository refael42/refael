import { describe, expect, it } from 'vitest';
import { GUIDE } from '../src/data/guide';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { ATTENDED_RANK, guideNewDay, guideProgress, publish, SUSPECT_RANK } from '../src/sim/game/guide';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { Held } from '../src/sim/types';

// Guide 2.0 (owner: "improve the Michelin guide"): a rumor, look-alikes, the head chef's
// attention for one guest a day, the road to the next star, gems for each first mark.

/** Plays within one long day (the clock held at noon), so no other day's inspector comes. */
function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    s.dayTime = Math.min(s.dayTime, 60);
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

/** A rumor day, now: the inspector is due at once, the look-alikes soon after. */
function rumorDay(s: GameState): void {
  s.guide.rumor = true;
  s.guide.due = s.time + 2;
  s.guide.decoyAt = [s.time + 1, s.time + 10];
}

describe('the guide 2.0: a rumor, suspects and the head chef', () => {
  it('on most inspection days word gets around, with look-alikes the same day', () => {
    let rumors = 0;
    let inspections = 0;
    for (let day = GUIDE.firstDay; day < 200; day++) {
      const s = createGame(STAND_MAP, 60);
      s.day = day;
      guideNewDay(s);
      if (s.guide.due >= 0) inspections++;
      if (s.guide.rumor) {
        rumors++;
        expect(s.guide.due).toBeGreaterThanOrEqual(0);
        expect(s.guide.decoyAt).toHaveLength(GUIDE.decoys);
      }
    }
    expect(inspections).toBeGreaterThan(20);
    expect(rumors / inspections).toBeGreaterThan(0.6);
    expect(rumors).toBeLessThan(inspections);
  });

  it('suspects show a magnifier; the inspector writes in a notebook, look-alikes look at their phones', () => {
    const s = createGame(STAND_MAP, 61, { roster: ['cook', 'waiter', 'washer', 'waiter'] });
    rumorDay(s);
    let notebook = false;
    let suspects = 0;
    let decoys = 0;
    play(s, 240, (g) => {
      for (const c of g.customers) {
        if (c.inspector && c.held === Held.Notebook) notebook = true;
        if (c.suspect && c.held === Held.Notebook) throw new Error('a look-alike with the notebook');
      }
      suspects = Math.max(suspects, g.customers.filter((c) => c.rank === SUSPECT_RANK).length);
      decoys = Math.max(decoys, g.customers.filter((c) => c.suspect).length);
    });
    expect(decoys).toBeGreaterThanOrEqual(1);
    expect(suspects).toBeGreaterThanOrEqual(2);
    expect(notebook).toBe(true);
    // Once the inspector has gone, the rumor is over and nobody is a suspect any more.
    expect(s.guide.visits.length).toBe(1);
    expect(s.guide.rumor).toBe(false);
    expect(s.customers.some((c) => c.rank === SUSPECT_RANK)).toBe(false);
  });

  it('tapping the inspector sends the head chef: a better score than the same kitchen without', () => {
    const scores: number[] = [];
    for (const pick of [false, true]) {
      const s = createGame(STAND_MAP, 62, { roster: ['cook', 'waiter', 'washer', 'cook'] });
      // One great cook and one weak one: the head chef's hand matters.
      s.staff[0]!.stats.quality = 10;
      s.staff[0]!.level = 10;
      s.staff[3]!.stats.quality = 1;
      rumorDay(s);
      s.guide.decoyAt = [];
      let attended = false;
      play(s, 300, (g) => {
        if (!pick || attended) return;
        const target = tapTargets(g).find((t) => t.command.type === 'attend');
        if (target && target.command.type === 'attend' && g.customers.find((c) => c.id === (target.command as { customer: number }).customer)?.inspector) {
          queueCommand(g, target.command);
          attended = true;
        }
      });
      if (pick) expect(attended).toBe(true);
      expect(s.guide.visits).toHaveLength(1);
      scores.push(s.guide.visits[0]!.score);
      if (pick) {
        const n = s.notices.find((x) => x.kind === 'inspector');
        if (n && n.kind === 'inspector') expect(n.spotted).toBe(true);
      }
    }
    expect(scores[1]!).toBeGreaterThan(scores[0]!);
  });

  it('one guest a day: after the pick nobody else can be chosen, and a look-alike tips well', () => {
    const s = createGame(STAND_MAP, 63, { roster: ['cook', 'waiter', 'washer', 'waiter'] });
    rumorDay(s);
    s.guide.due = s.time + 60;
    let chosen = -1;
    let tip = 0;
    play(s, 240, (g) => {
      if (chosen < 0) {
        const decoy = g.customers.find((c) => c.suspect && c.rank === SUSPECT_RANK && c.table >= 0);
        if (decoy) {
          queueCommand(g, { type: 'attend', customer: decoy.id });
          chosen = decoy.id;
        }
      } else {
        expect(tapTargets(g).some((t) => t.command.type === 'attend')).toBe(false);
      }
      const c = g.customers.find((x) => x.id === chosen);
      if (c && c.state === CustomerState.Paying && tip === 0) tip = 1;
    });
    expect(chosen).toBeGreaterThan(0);
    expect(s.guide.attention).toBe(chosen);
    expect(tip).toBe(1);
    // The next day starts over.
    s.day += 1;
    guideNewDay(s);
    expect(s.guide.attention).toBe(-1);
    expect(s.customers.some((c) => c.rank === SUSPECT_RANK)).toBe(false);
    expect(ATTENDED_RANK).not.toBe(SUSPECT_RANK);
  });

  it('each mark pays its gems once (the plate, then each star), and the best mark is saved', () => {
    const s = createGame(STAND_MAP, 64);
    // No chef levels here (their coins and chests would muddle the comparison).
    s.chef.xp = -1e12;
    const gems0 = s.gems;
    // Straight to the first star: the plate's gems and the star's.
    s.guide.visits = [{ day: 3, score: 90 }, { day: 5, score: 88 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    expect(s.gems - gems0).toBe(GUIDE.rewardGems[0]! + GUIDE.rewardGems[1]!);
    expect(s.guide.last?.gems).toBe(GUIDE.rewardGems[0]! + GUIDE.rewardGems[1]!);
    // Lose it and win it back: nothing the second time.
    s.guide.visits = [{ day: 8, score: 40 }];
    publish(s);
    expect(s.guide.stars).toBe(0);
    const gems1 = s.gems;
    s.guide.visits = [{ day: 15, score: 90 }, { day: 17, score: 90 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    expect(s.gems).toBe(gems1);
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(restoreGame(loaded.save, 64, Date.now()).guide.best).toBe(1);
  });

  it('the road to the next star says what is missing', () => {
    const s = createGame(STAND_MAP, 65);
    expect(guideProgress(s).status).toBe('noVisits');
    expect(guideProgress(s).gems).toBe(GUIDE.rewardGems[1]);
    s.guide.visits = [{ day: 3, score: 75 }];
    expect(guideProgress(s).status).toBe('moreVisits');
    s.guide.visits.push({ day: 4, score: 50 });
    expect(guideProgress(s).status).toBe('badNight');
    s.guide.visits = [{ day: 3, score: 65 }, { day: 4, score: 66 }];
    expect(guideProgress(s).status).toBe('avgLow');
    s.guide.visits = [{ day: 3, score: 75 }, { day: 4, score: 80 }];
    expect(guideProgress(s).status).toBe('onTrack');
    s.guide.stars = 2;
    s.guide.visits = [{ day: 3, score: 60 }];
    expect(guideProgress(s).risk).toBe(true);
    s.guide.stars = 3;
    expect(guideProgress(s).status).toBe('top');
  });
});
