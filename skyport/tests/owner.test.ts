import { describe, expect, it } from 'vitest';

import { DICTS } from '../src/i18n/strings';
import { createGame, queueCommand, stepGame } from '../src/sim';
import { OWNER_COINS, OWNER_GEMS } from '../src/sim/game/commands';

const step = (s: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) stepGame(s);
};

describe('owner tools (hidden in the settings)', () => {
  it('the gift adds a pile of coins and diamonds', () => {
    const s = createGame(5);
    const coins = s.money.toNumber();
    const gems = s.diamonds;
    queueCommand(s, { type: 'ownerGift' });
    stepGame(s);
    expect(s.money.toNumber()).toBeGreaterThanOrEqual(coins + OWNER_COINS * 0.999);
    expect(s.diamonds).toBe(gems + OWNER_GEMS);
  });

  it('the next stage is built at once, its needs and cost waived', () => {
    const s = createGame(6);
    expect(s.tier).toBe(1);
    const money = s.money.toNumber();
    queueCommand(s, { type: 'ownerTier' });
    stepGame(s);
    expect(s.tierBuild?.to).toBe(2);
    expect(s.money.toNumber()).toBeCloseTo(money, 0);
    // (it opens once no plane is on the ground: a fresh game has none yet)
    s.flights.length = 0;
    step(s, 4);
    expect(s.tier).toBe(2);
  });

  it('is named in both languages', () => {
    for (const lang of ['en', 'he'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      for (const k of ['settings.owner', 'settings.ownerGift', 'settings.ownerTier', 'settings.ownerGiftDone', 'settings.ownerTierDone']) expect(d[k], `${lang} ${k}`).toBeTruthy();
    }
  });
});
