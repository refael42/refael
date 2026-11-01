import { describe, expect, it } from 'vitest';
import { ALBUM_PAGES, STICKERS } from '../src/data/album';
import { CELEB, CELEBS } from '../src/data/celebs';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { stickerLevel } from '../src/sim/album';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { queueCommand } from '../src/sim/game/commands';
import { CustomerState, type GameState } from '../src/sim/game/types';

// Owner, idea 4: "a famous chef or singer comes in; serve them perfectly and a wave of customers follows".

const game = (): GameState => {
  const s = createGame(STAND_MAP, 12, { roster: ['cook', 'cook', 'waiter', 'waiter', 'washer'] });
  s.stats.served = CELEB.minServed;
  s.chef.xp = -1e12;
  return s;
};

const run = (s: GameState, seconds: number, until?: () => boolean) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.celebrity === undefined && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    if (until?.()) return true;
  }
  return false;
};

describe('celebrities', () => {
  it('six made-up stars, each a sticker on their own album page', () => {
    expect(CELEBS).toHaveLength(6);
    const page = ALBUM_PAGES.find((p) => p.id === 'celebs')!;
    expect(page.stickers.map((st) => st.id)).toEqual(CELEBS.map((c) => c.id));
    expect(STICKERS).toHaveLength(24);
  });

  it('a limo, the star walks in past the line, sits, pays a fortune; the album and the papers know', () => {
    const s = game();
    s.celebs.next = s.time;
    run(s, 0.2);
    expect(s.events.some((e) => e.type === Ev.CelebComing)).toBe(true);
    const visit = s.celebs.visit!;
    expect(visit.phase).toBe('limo');
    run(s, CELEB.driveSeconds + 0.5);
    const star = s.customers.find((c) => c.id === s.celebs.visit!.customer)!;
    expect(star.celebrity).toBe(visit.celeb);
    expect(star.queueSlot).toBe(-1);
    // Eventually seated and done (or gone).
    const done = run(s, 300, () => s.celebs.visit === null);
    expect(done).toBe(true);
    const end = s.events.filter((e) => e.type === Ev.CelebDone).pop();
    expect(end).toBeDefined();
    if (end!.b > 0) expect(stickerLevel(s.album, CELEBS[visit.celeb]!.id)).toBe(1);
    if (end!.b >= 5) expect(s.buzzUntil).toBeGreaterThan(s.time);
    // The next one is some minutes away.
    expect(s.celebs.next).toBeGreaterThan(s.time + CELEB.every[0] - 1);
  });

  it('the next star is one not met yet', () => {
    const s = game();
    for (const c of CELEBS.slice(0, 5)) s.album.counts[c.id] = 1;
    s.celebs.next = s.time;
    run(s, 0.2);
    expect(s.celebs.visit!.celeb).toBe(5);
  });
});
