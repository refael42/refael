import { describe, expect, it } from 'vitest';
import { ALBUM, ALBUM_PAGES, STICKERS } from '../src/data/album';
import { CUSTOMER_TYPE_LIST, CUSTOMER_TYPES, KID_RANK } from '../src/data/customers';
import { Dish } from '../src/data/dishes';
import { STAND_MAP } from '../src/data/maps';
import { DAY } from '../src/data/staff';
import { STEP_SEC } from '../src/data/sim';
import { albumReady, albumServed, claimPage, claimSticker, pageReady, stickerLevel } from '../src/sim/album';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type Customer, type GameState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { openBranch } from '../src/sim/franchise';

// Owner M52: "add idea 9, a customer album, and add more customers".

const team = ['cook', 'waiter', 'washer'] as const;
const game = (): GameState => createGame(STAND_MAP, 9, { roster: [...team] });
const guest = (type: string, extra: Partial<Customer> = {}): Customer => ({ id: 1, party: 1, partySize: 1, type, vip: false, rank: 0, ...extra }) as unknown as Customer;

describe('more customers', () => {
  it('fourteen kinds, each with its own look, the new ones coming as the place gets known', () => {
    expect(CUSTOMER_TYPE_LIST.length).toBe(14);
    const looks = new Set(CUSTOMER_TYPE_LIST.map((t) => JSON.stringify(t.look)));
    expect(looks.size).toBe(14);
    for (const t of CUSTOMER_TYPE_LIST) if (!['regular', 'rushed', 'tourist', 'student'].includes(t.id)) expect((t.minServed ?? 0) > 0).toBe(true);
    // Every kind is a sticker.
    for (const t of CUSTOMER_TYPE_LIST) expect(STICKERS.some((st) => st.id === t.id)).toBe(true);
  });

  it('the tycoon comes only to the grand restaurant, the party only in the evening', () => {
    const s = game();
    s.stats.served = 1000;
    s.nextArrival = 0;
    const seen = new Set<string>();
    const sample = () => {
      for (let i = 0; i < 400; i++) {
        s.customers.length = 0;
        s.nextArrival = 0;
        stepGame(s, STEP_SEC);
        for (const c of s.customers) seen.add(c.type);
      }
    };
    s.dayTime = 0.1 * DAY.seconds;
    sample();
    expect(seen.has('tycoon')).toBe(false);
    expect(seen.has('party')).toBe(false);
    expect(seen.has('grandma')).toBe(true);
    s.dayTime = 0.8 * DAY.seconds;
    s.mods = { ...s.mods, building: 2 };
    sample();
    expect(seen.has('party')).toBe(true);
  });

  it('the builder eats faster, the athlete orders light, the influencer brings a crowd, the musician calms the room', () => {
    expect(CUSTOMER_TYPES.builder.eatSpeed).toBeGreaterThan(1);
    expect(CUSTOMER_TYPES.athlete.favorites).toContain(Dish.Salad);
    expect(CUSTOMER_TYPES.foodie.reviewChance).toBeGreaterThan(0.5);
    const s = game();
    s.chef.xp = -1e12;
    // Musician: while one eats, patience drains slower.
    s.musicUntil = s.time + 10;
    s.musicCalm = CUSTOMER_TYPES.musician.music!;
    expect(s.musicCalm).toBeLessThan(1);
    // Influencer: a five-star visit buzzes.
    const before = s.buzzUntil;
    let buzzed = false;
    for (let i = Math.round(400 / STEP_SEC); i > 0 && !buzzed; i--) {
      for (const c of s.customers) {
        if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
        if (c.state === CustomerState.Arriving && c.type !== 'influencer') c.type = 'influencer';
      }
      stepGame(s, STEP_SEC);
      buzzed = s.events.some((e) => e.type === Ev.Influencer);
    }
    expect(buzzed).toBe(true);
    expect(s.buzzUntil).toBeGreaterThan(before);
  });
});

describe('the album', () => {
  it('the first guest of a kind sticks it in (said once); regulars earn stars', () => {
    const s = game();
    albumServed(s, guest('grandma'));
    expect(stickerLevel(s.album, 'grandma')).toBe(1);
    expect(s.events.filter((e) => e.type === Ev.AlbumNew)).toHaveLength(1);
    albumServed(s, guest('grandma'));
    expect(s.events.filter((e) => e.type === Ev.AlbumNew)).toHaveLength(1);
    s.album.counts.grandma = ALBUM.stars[2]!;
    expect(stickerLevel(s.album, 'grandma')).toBe(4);
  });

  it('special guests count too: VIPs, children, big parties, the inspector', () => {
    const s = game();
    albumServed(s, guest('regular', { vip: true }));
    albumServed(s, guest('tourist', { rank: KID_RANK }));
    albumServed(s, guest('party', { partySize: ALBUM.banquetSize }));
    albumServed(s, guest('regular', { inspector: true }));
    for (const id of ['vip', 'kid', 'banquet', 'inspector'] as const) expect(stickerLevel(s.album, id)).toBe(1);
    // A big party's friend (not its leader) does not count it twice.
    albumServed(s, guest('party', { id: 2, party: 1, partySize: ALBUM.banquetSize }));
    expect(s.album.counts.banquet).toBe(1);
  });

  it('pays the sticker and each star in order, once each', () => {
    const s = game();
    s.album.counts.athlete = ALBUM.stars[1]!;
    expect(albumReady(s.album)).toBe(3);
    const gems = s.gems;
    while (claimSticker(s, 'athlete'));
    expect(s.gems).toBe(gems + ALBUM.stickerGems + ALBUM.starGems[0]! + ALBUM.starGems[1]!);
    expect(claimSticker(s, 'athlete')).toBe(false);
  });

  it('a full page gives its bonus for good; all in gold, a bag of gems', () => {
    const s = game();
    const page = ALBUM_PAGES[1]!;
    for (const st of page.stickers.slice(1)) s.album.counts[st.id] = 1;
    expect(pageReady(s.album, 1).full).toBe(false);
    s.album.counts[page.stickers[0]!.id] = 1;
    expect(pageReady(s.album, 1).full).toBe(true);
    const tips = s.mods.tips;
    expect(claimPage(s, 1)).toBe(true);
    expect(s.mods.tips).toBeCloseTo(tips * page.perk.mult, 6);
    expect(claimPage(s, 1)).toBe(false);
    for (const st of page.stickers) s.album.counts[st.id] = ALBUM.stars[2]!;
    const gems = s.gems;
    expect(claimPage(s, 1)).toBe(true);
    expect(s.gems).toBe(gems + ALBUM.goldGems);
  });

  it('is kept in the save and goes along to a new branch', () => {
    const s = game();
    s.album.counts.foodie = 12;
    s.album.taken.foodie = 1;
    s.album.pages[0] = 1;
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    expect(back.album.counts.foodie).toBe(12);
    expect(back.album.taken.foodie).toBe(1);
    expect(back.album.pages[0]).toBe(1);
    back.stats.earned = back.stats.earned.add(1e15);
    back.levels = { ...back.levels, building: 6 };
    expect(openBranch(back)).toBe(true);
    expect(back.album.counts.foodie).toBe(12);
  });

  it('in play: serving guests fills it', () => {
    const s = game();
    s.chef.xp = -1e12;
    for (let i = Math.round(240 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
    }
    const counted = Object.values(s.album.counts).reduce((a, b) => a + (b ?? 0), 0);
    expect(counted).toBeGreaterThanOrEqual(s.stats.served);
    expect(STICKERS.filter((st) => stickerLevel(s.album, st.id) > 0).length).toBeGreaterThanOrEqual(2);
  });
});
