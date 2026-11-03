/** A mid-game save written 'hoursAgo' hours ago (fixture for load/offline tests). */
const fixture = (hoursAgo) =>
  JSON.stringify({
    v: 4,
    savedAt: Date.now() - hoursAgo * 3600 * 1000,
    game: {
      seed: 5,
      tick: 54000,
      tier: 1,
      money: [1.25, 3],
      rating: 4.6,
      upg: { ticket: 14, landing: 11, kiosk: 8, stand: 2, billboard: 4, benches: 12, pump: 6, carts: 6 },
      staff: [
        { id: 3, role: 0, first: 2, last: 3, speed: 1.1, wage: 40 },
        { id: 4, role: 1, first: 5, last: 1, speed: 1.0, wage: 25 },
        { id: 5, role: 2, first: 7, last: 2, speed: 1.2, wage: 22 },
        { id: 6, role: 3, first: 9, last: 4, speed: 1.0, wage: 18 },
      ],
      income: { hist: [900, 950, 1000, 980, 1020], histComp: [] },
      stats: { served: 120 },
      nextId: 50,
    },
  });

export default [
  { name: 'game-start-phone', viewport: { width: 844, height: 390 }, query: '/?seed=7', wait: 4500, touch: true },
  { name: 'game-busy-phone', viewport: { width: 844, height: 390 }, query: '/?seed=7&warp=95&auto=1&select=1', wait: 3000, touch: true },
  { name: 'game-busy-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=3&warp=140&auto=1', wait: 3000, touch: true },
  { name: 'game-small-landscape', viewport: { width: 667, height: 375 }, query: '/?seed=5&warp=60&auto=1&select=1', wait: 2500, touch: true },
  { name: 'game-request-phone', viewport: { width: 844, height: 390 }, query: '/?seed=11&warp=14', wait: 1500, touch: true, langs: ['he', 'en'] },
  {
    // Taps the plane's bubble (or its edge marker) for every request until one flight has paid.
    name: 'tap-flow-phone',
    viewport: { width: 844, height: 390 },
    query: '/?seed=21&hook=1&speed=3',
    wait: 1500,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      const deadline = Date.now() + 60000;
      let taps = 0;
      let shotDone = false;
      while (Date.now() < deadline) {
        const st = await page.evaluate(() => window.__skyport.stats());
        if (st.served >= 1) break;
        const target = await page.evaluate(() => {
          const h = window.__skyport;
          const ind = h.indicators();
          if (ind.length) return { x: ind[0].vx, y: ind[0].vy, kind: 'edge' };
          const f = h.flights().find((x) => x.want !== 0);
          return f ? { x: f.vx, y: f.vy, kind: 'bubble', phase: f.phase } : null;
        });
        if (target && target.y > 0 && target.y < 390) {
          await page.touchscreen.tap(target.x, target.y);
          taps++;
          if (!shotDone && taps === 3) {
            shotDone = true;
            await page.waitForTimeout(400);
            await page.screenshot({ path: 'artifacts/screens/tap-flow-mid-en.png' });
          }
        }
        await page.waitForTimeout(400);
      }
      const st = await page.evaluate(() => window.__skyport.stats());
      if (st.served < 1) throw new Error(`no flight served after ${taps} taps: ${JSON.stringify(st)}`);
      console.log(`     tap flow: ${taps} taps, served ${st.served}, money ${st.money}`);
    },
  },
  {
    name: 'settings-phone',
    viewport: { width: 844, height: 390 },
    query: '/?seed=2',
    wait: 1500,
    touch: true,
    actions: async (page) => {
      await page.getByRole('button', { name: /Settings|הגדרות/ }).first().click();
      await page.waitForTimeout(500);
    },
  },
  { name: 'm2-crew-phone', viewport: { width: 844, height: 390 }, query: '/?seed=4&stands=3&crew=1&warp=150&speed=1', wait: 3000, touch: true },
  { name: 'm2-crew-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=6&stands=3&crew=1&warp=210', wait: 3000, touch: true },
  { name: 'm2-staff-panel', viewport: { width: 844, height: 390 }, query: '/?seed=4&money=400&panel=staff', wait: 2000, touch: true },
  { name: 'm3-upgrades-panel', viewport: { width: 844, height: 390 }, query: '/?seed=4&money=3000&panel=upgrades', wait: 2000, touch: true },
  { name: 'm3-progress-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=3&warp=1500&auto=1', wait: 2500, touch: true },
  { name: 'm3-progress-phone', viewport: { width: 844, height: 390 }, query: '/?seed=3&warp=1500&auto=1', wait: 2500, touch: true, langs: ['he'] },
  { name: 'm3-welcome-back', viewport: { width: 844, height: 390 }, query: '/?save=1', wait: 2500, touch: true, save: fixture(2) },
  {
    // plays, autosaves, reloads and checks that the money came back
    name: 'm3-save-reload',
    viewport: { width: 844, height: 390 },
    query: '/?save=1&seed=9&auto=1&warp=400&hook=1',
    wait: 9500,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      const raw = await page.evaluate(() => localStorage.getItem('skyport.save.v1'));
      if (!raw) throw new Error('no autosave after 11 s');
      const file = JSON.parse(raw);
      if (!(file.v >= 4)) throw new Error('unexpected save version ' + file.v);
      const before = await page.evaluate(() => window.__skyport.stats());
      await page.goto(page.url().replace(/\?.*$/, '?save=1&hook=1'));
      // the reloaded game is up once its test hook is (the atlas build takes a few seconds on CI)
      await page.waitForFunction(() => !!window.__skyport, null, { timeout: 20000 });
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => window.__skyport.stats());
      if (!(before.money > 0)) throw new Error('nothing earned before saving');
      // the reloaded game continues from the save (plus a little offline pay), not from zero
      if (after.time + 15 < before.time || after.money < before.money * 0.5) throw new Error(`reload lost the game: ${JSON.stringify({ before, after })}`);
      console.log(`     save/reload: before t=${before.time.toFixed(0)} money=${before.money} -> after t=${after.time.toFixed(0)} money=${after.money}`);
    },
  },
  { name: 'm4-team', viewport: { width: 844, height: 390 }, query: '/?seed=4&crew=1&warp=900&auto=1&panel=staff', wait: 2500, touch: true },
  { name: 'm4-applicants', viewport: { width: 844, height: 390 }, query: '/?seed=8&warp=500&money=3000&panel=staff', wait: 2500, touch: true },
  { name: 'm5-tier2-phone', viewport: { width: 844, height: 390 }, query: '/?seed=5&tier=2&stands=5&crew=1&warp=240&auto=1', wait: 3000, touch: true },
  { name: 'm5-tier2-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=5&tier=2&stands=5&crew=1&warp=240&auto=1&build=1', wait: 3000, touch: true },
  { name: 'm5-tier-panel', viewport: { width: 844, height: 390 }, query: '/?seed=7&warp=700&auto=1&panel=airport', wait: 2000, touch: true },
  {
    // drag the kiosk in build mode and check it moved
    name: 'm5-build-drag',
    viewport: { width: 844, height: 390 },
    query: '/?seed=5&build=1&panel=build&hook=1',
    wait: 2000,
    langs: ['en'],
    actions: async (page) => {
      const before = await page.evaluate(() => window.__skyport.decor().find((d) => d.id === 'kiosk'));
      if (!before) throw new Error('no kiosk to drag');
      // a grassy spot inside the fence, east of the apron
      const target = await page.evaluate(() => window.__skyport.toView(30, 20));
      await page.mouse.move(before.vx, before.vy);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(before.vx + ((target.vx - before.vx) * i) / 12, before.vy + ((target.vy - 10 - before.vy) * i) / 12);
      await page.waitForTimeout(150);
      await page.screenshot({ path: 'artifacts/screens/m5-build-dragging-en.png' });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => window.__skyport.decor().find((d) => d.id === 'kiosk'));
      if (!after || (after.x === before.x && after.y === before.y)) throw new Error(`kiosk did not move: ${JSON.stringify({ before, after })}`);
      console.log(`     build drag: kiosk ${before.x},${before.y} -> ${after.x},${after.y}`);
    },
  },
  {
    // first launch: language, names, how-to cards, then the tutorial hand points at the plane
    name: 'm5-onboarding',
    viewport: { width: 844, height: 390 },
    query: '/',
    wait: 2500,
    touch: true,
    settings: { onboarded: false },
    noCanvas: true,
    actions: async (page) => {
      const lang = await page.evaluate(() => JSON.parse(localStorage.getItem('skyport.settings.v1')).state.lang);
      const next = lang === 'he' ? /הבא|יאללה/ : /Next|fly/;
      await page.screenshot({ path: `artifacts/screens/m5-onboarding-1-${lang}.png` });
      await page.getByRole('button', { name: next }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `artifacts/screens/m5-onboarding-2-${lang}.png` });
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: next }).click();
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(7000);
    },
  },
  { name: 'm6-terminal-phone', viewport: { width: 844, height: 390 }, query: '/?seed=5&crew=1&warp=300&auto=1&cam=20.5,17.5,1.5', wait: 4500, touch: true },
  { name: 'm6-terminal-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=8&crew=1&warp=420&auto=1&tier=2&stands=4', wait: 2500, touch: true },
  { name: 'm6-upgrades-terminal', viewport: { width: 844, height: 390 }, query: '/?seed=5&money=2000&panel=upgrades', wait: 2000, touch: true, langs: ['he'] },
  { name: 'm7-airlines-contracts', viewport: { width: 844, height: 390 }, query: '/?seed=5&warp=400&auto=1&crew=1&panel=airlines', wait: 2000, touch: true },
  { name: 'm7-airlines-offers', viewport: { width: 844, height: 390 }, query: '/?seed=5&warp=130&panel=airlines&tab=1', wait: 2000, touch: true },
  {
    // haggle with an airline: ask for more pay, the offer changes or the airline walks away
    name: 'm7-negotiate',
    viewport: { width: 844, height: 390 },
    query: '/?seed=5&warp=130&panel=airlines&tab=1&hook=1',
    wait: 2000,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      const before = await page.evaluate(() => window.__skyport.airlines().offers);
      if (before.length === 0) throw new Error('no offer to negotiate');
      await page.getByTestId(`ask-${before[0].airline}`).click();
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => window.__skyport.airlines().offers);
      const o = after.find((x) => x.id === before[0].id);
      if (o && !(o.negotiated && o.pay > before[0].pay)) throw new Error(`asking did nothing: ${JSON.stringify({ before, after })}`);
      if (o) {
        await page.getByTestId(`sign-${o.airline}`).click();
        await page.waitForTimeout(600);
        const c = await page.evaluate(() => window.__skyport.airlines().contracts);
        if (!c.some((x) => x.id === o.airline)) throw new Error(`signing failed: ${JSON.stringify(c)}`);
      }
      await page.screenshot({ path: 'artifacts/screens/m7-negotiated-en.png' });
      console.log(`     negotiate: ${o ? `pay ${before[0].pay} -> ${o.pay}, signed` : 'they walked away'}`);
    },
  },
  { name: 'm7-board-phone', viewport: { width: 844, height: 390 }, query: '/?seed=5&warp=420&auto=1&crew=1&stands=2&panel=board', wait: 2000, touch: true },
  { name: 'm7-board-arrivals', viewport: { width: 844, height: 390 }, query: '/?seed=5&warp=420&auto=1&crew=1&stands=2&panel=board&tab=1', wait: 2000, touch: true, langs: ['he'] },
  { name: 'm7-board-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=6&tier=2&stands=5&crew=1&warp=500&auto=1&panel=board', wait: 2000, touch: true },
  {
    // tapping a flight on the board closes it and selects that plane on the map
    name: 'm7-board-pick',
    viewport: { width: 844, height: 390 },
    query: '/?seed=5&warp=420&auto=1&crew=1&stands=2&panel=board&hook=1',
    wait: 2000,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      const ids = await page.evaluate(() => window.__skyport.flights().map((f) => f.id));
      const row = page.locator('[data-testid^="board-row-f"]').first();
      if ((await row.count()) === 0) throw new Error(`no live flight on the board (flights ${ids})`);
      const key = (await row.getAttribute('data-testid')).replace('board-row-f', '');
      await row.click();
      await page.waitForTimeout(800);
      const sel = await page.evaluate(() => window.__skyport.selected());
      if (String(sel) !== key) throw new Error(`picked ${key}, selected ${sel}`);
      if ((await page.getByTestId('flight-board').count()) > 0) throw new Error('board still open');
      await page.screenshot({ path: 'artifacts/screens/m7-board-picked-en.png' });
      console.log(`     board pick: flight ${key} selected`);
    },
  },
  { name: 'm7-bar-small', viewport: { width: 568, height: 320 }, query: '/?seed=3&warp=60', wait: 2000, touch: true },
  { name: 'tablet-landscape', viewport: { width: 1180, height: 820 }, query: '/?seed=5&tier=2&stands=4&crew=1&warp=300&auto=1&select=1', wait: 2500, touch: true, scale: 1 },
  { name: 'panel-small-landscape', viewport: { width: 568, height: 320 }, query: '/?seed=4&money=3000&panel=upgrades', wait: 2000, touch: true },
  {
    // the game is landscape only: a phone browser held upright shows the rotate screen
    name: 'rotate-portrait',
    viewport: { width: 390, height: 844 },
    query: '/?seed=2',
    wait: 1500,
    touch: true,
    langs: ['he'],
    actions: async (page) => {
      if (!(await page.getByTestId('rotate-hint').isVisible())) throw new Error('no rotate hint on an upright phone');
      await page.screenshot({ path: 'artifacts/screens/rotate-hint-he.png' });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(800);
      if ((await page.getByTestId('rotate-hint').count()) > 0) throw new Error('rotate hint still there in landscape');
    },
  },
  // close-ups of the world art (vehicles, cars, props)
  { name: 'art-parking', viewport: { width: 844, height: 390 }, query: '/?seed=5&crew=1&warp=620&auto=1&cam=23.4,14.8,2.1', wait: 2500, touch: true, langs: ['en'] },
  { name: 'art-apron', viewport: { width: 844, height: 390 }, query: '/?seed=5&crew=1&warp=300&auto=1&stands=3&cam=23.8,21.2,2.3', wait: 2500, touch: true, langs: ['en'] },
  { name: 'art-runway', viewport: { width: 844, height: 390 }, query: '/?seed=6&tier=2&stands=5&crew=1&warp=500&auto=1&cam=19,24.5,1.5', wait: 2500, touch: true, langs: ['en'] },
  { name: 'art-gallery-cars', viewport: { width: 844, height: 390 }, query: '/?screen=gallery&cam=5,17.8,2.4', wait: 2500, touch: true, langs: ['en'] },
  { name: 'art-gallery-vehicles', viewport: { width: 844, height: 390 }, query: '/?screen=gallery&cam=12.4,2.8,2.6', wait: 2500, touch: true, langs: ['en'] },
  {
    // a few moments of a busy apron: planes being served by the truck and the bag train
    name: 'art-service',
    viewport: { width: 844, height: 390 },
    query: '/?seed=9&crew=1&stands=3&warp=180&auto=1&cam=23.4,21.6,2.2&follow=1',
    wait: 1500,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      for (let k = 0; k < 4; k++) {
        await page.waitForTimeout(2200);
        await page.screenshot({ path: `artifacts/screens/art-service-${k}.png` });
      }
    },
  },
  {
    // planes in the air: wingtip lights, beacon and strobes
    name: 'art-lights',
    viewport: { width: 844, height: 390 },
    query: '/?seed=4&crew=1&stands=3&warp=150&cam=15,21,2.6&follow=1',
    wait: 1500,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      for (let k = 0; k < 3; k++) {
        await page.waitForTimeout(700);
        await page.screenshot({ path: `artifacts/screens/art-lights-${k}.png` });
      }
    },
  },
  // M8: the bigger airports with everything built and their fleets flying
  { name: 'm8-tier3', viewport: { width: 844, height: 390 }, query: '/?seed=5&tier=3&full=1&crew=1&warp=260&auto=1', wait: 3000, touch: true },
  { name: 'm8-tier4', viewport: { width: 844, height: 390 }, query: '/?seed=5&tier=4&full=1&crew=1&warp=300&auto=1', wait: 3000, touch: true },
  { name: 'm8-tier5', viewport: { width: 844, height: 390 }, query: '/?seed=5&tier=5&full=1&crew=1&warp=340&auto=1', wait: 3000, touch: true },
  { name: 'm8-tier5-tablet', viewport: { width: 1180, height: 820 }, query: '/?seed=6&tier=5&full=1&crew=1&warp=400&auto=1', wait: 3000, touch: true, scale: 1, langs: ['en'] },
  { name: 'm8-gates', viewport: { width: 844, height: 390 }, query: '/?seed=7&tier=4&full=1&crew=1&warp=320&auto=1&cam=46.5,19.5,1.5', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm8-cargo-fbo', viewport: { width: 844, height: 390 }, query: '/?seed=8&tier=5&full=1&crew=1&warp=360&auto=1&cam=36,19.5,1.3', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm8-runways', viewport: { width: 844, height: 390 }, query: '/?seed=9&tier=5&full=1&crew=1&warp=300&auto=1&cam=16,29,1.0', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm9-fog', viewport: { width: 844, height: 390 }, query: '/?seed=11&tier=3&full=1&crew=1&warp=200&auto=1&wx=fog&select=1', wait: 3000, touch: true },
  { name: 'm9-west', viewport: { width: 844, height: 390 }, query: '/?seed=12&tier=4&full=1&crew=1&warp=320&auto=1&wx=west', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm9-west-close', viewport: { width: 844, height: 390 }, query: '/?seed=12&tier=4&full=1&crew=1&warp=320&auto=1&wx=west&cam=50,25,1.4', wait: 3000, touch: true, langs: ['he'] },
  { name: 'm9-cross', viewport: { width: 844, height: 390 }, query: '/?seed=13&tier=2&stands=3&crew=1&warp=200&auto=1&wx=cross&select=1', wait: 3000, touch: true },
  { name: 'm9-tower', viewport: { width: 844, height: 390 }, query: '/?seed=14&tier=3&full=1&crew=1&warp=120&auto=1&wx=cross&cam=17.6,15.9,2.2', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm10-depot', viewport: { width: 844, height: 390 }, query: '/?seed=31&tier=3&full=1&crew=1&warp=200&auto=1&tanker=1&cam=31.3,15.4,1.7', wait: 3000, touch: true },
  { name: 'm10-depot-t2', viewport: { width: 844, height: 390 }, query: '/?seed=32&tier=2&stands=4&crew=1&warp=240&auto=1&tanker=1&cam=30,17,1.8', wait: 3000, touch: true, langs: ['en'] },
  { name: 'm10-hangar', viewport: { width: 844, height: 390 }, query: '/?seed=33&tier=4&full=1&crew=1&warp=420&auto=1&cam=12,19.6,1.35', wait: 3000, touch: true },
  { name: 'm10-fault', viewport: { width: 844, height: 390 }, query: '/?seed=34&tier=3&full=1&crew=1&warp=160&auto=1&fault=1&select=1', wait: 3000, touch: true },
  { name: 'm10-panel', viewport: { width: 844, height: 390 }, query: '/?seed=35&tier=3&full=1&crew=1&warp=200&auto=1&tanker=1&panel=supplies', wait: 2500, touch: true },
  { name: 'm10-panel-tablet', viewport: { width: 1180, height: 820 }, query: '/?seed=35&tier=4&full=1&crew=1&warp=300&auto=1&panel=supplies', wait: 2500, touch: true, scale: 1, langs: ['he'] },
  { name: 'gallery-phone', viewport: { width: 844, height: 390 }, query: '/?screen=gallery', wait: 2500, touch: true, langs: ['he'] },
];
