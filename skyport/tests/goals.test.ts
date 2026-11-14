import { describe, expect, it } from 'vitest';

import { applyStructural, botAirlines, botBuys, botCommands, botHires, createGame, currentGoal, GOALS, parseSave, queueCommand, serializeGame, stepGame, switchTier } from '../src/sim';

describe('goals', () => {
  it('every goal has a unique id and a reward', () => {
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
    for (const g of GOALS) expect(g.reward).toBeGreaterThan(0);
  });

  it('a new game starts at the first goal: land a plane', () => {
    const s = createGame(1);
    expect(currentGoal(s)?.id).toBe('firstFlight');
    expect(currentGoal(s)!.progress(s)).toEqual({ have: 0, need: 1 });
  });

  it('a done goal pays its reward once and the next one comes up', () => {
    const s = createGame(2);
    s.stats.served = 1;
    const before = s.money.toNumber();
    for (let i = 0; i < 10; i++) stepGame(s);
    expect(s.goal).toBe(1);
    expect(s.events.some((e) => e.kind === 'goalDone' && e.a === 0 && e.b === GOALS[0].reward)).toBe(true);
    // (no flight paid in those few steps)
    expect(s.money.toNumber()).toBe(before + GOALS[0].reward);
    for (let i = 0; i < 30; i++) stepGame(s);
    expect(s.goal).toBe(1);
  });

  it('the bot works through the early goals by just playing', () => {
    const s = createGame(3);
    for (let i = 0; i < 30 * 60 * 60; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
      if (i % 150 === 0) for (const c of [...botHires(s), ...botAirlines(s), ...botBuys(s)]) queueCommand(s, c);
      stepGame(s);
    }
    // an hour in: past the first steps, onto the second airport's goals
    expect(s.goal).toBeGreaterThanOrEqual(GOALS.findIndex((g) => g.id === 'tier2'));
  }, 120000);

  it('an old save without goals skips what is done, without paying for it', () => {
    const s = createGame(4);
    switchTier(s, 2);
    s.stats.served = 50;
    s.upg.stand = 2;
    s.upgRev++;
    applyStructural(s);
    const text = serializeGame(s, 1000);
    const file = JSON.parse(text);
    delete file.game.goal;
    const r = parseSave(JSON.stringify(file), 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // first flight, five flights, a second stand... done; an upgrade was bought too (stands)
    expect(r.state.goal).toBeGreaterThanOrEqual(3);
    expect(r.state.money.toNumber()).toBe(s.money.toNumber());
  });

  it('a save keeps the goal reached', () => {
    const s = createGame(5);
    s.goal = 7;
    const r = parseSave(serializeGame(s, 1000), 1000);
    expect(r.ok && r.state.goal).toBe(7);
  });

  it('a save keeps the goal by id: goals added before it since are skipped', () => {
    const s = createGame(9);
    s.goal = GOALS.findIndex((g) => g.id === 'tier3');
    const file = JSON.parse(serializeGame(s, 1000));
    expect(file.game.goalId).toBe('tier3');
    // (an older numbering: the index points somewhere else, the id wins)
    file.game.goal = 3;
    const r = parseSave(JSON.stringify(file), 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(GOALS[r.state.goal].id).toBe('tier3');
  });

  it('the land has its goals, between the small airfield and the regional one', () => {
    const ids = GOALS.map((g) => g.id);
    for (const id of ['firstPlot', 'firstFacility', 'firstHarvest', 'plots5']) expect(ids).toContain(id);
    expect(ids.indexOf('firstPlot')).toBeLessThan(ids.indexOf('tier3'));
    expect(ids.indexOf('firstPlot')).toBeGreaterThan(ids.indexOf('tier2'));
  });
});
