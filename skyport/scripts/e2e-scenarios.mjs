/** A mid-game save written 'hoursAgo' hours ago (fixture for load/offline tests). */
const fixture = (hoursAgo) =>
  JSON.stringify({
    v: 3,
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
  { name: 'game-start-phone', viewport: { width: 390, height: 844 }, query: '/?seed=7', wait: 4500, touch: true },
  { name: 'game-busy-phone', viewport: { width: 390, height: 844 }, query: '/?seed=7&warp=95&auto=1&select=1', wait: 3000, touch: true },
  { name: 'game-busy-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=3&warp=140&auto=1', wait: 3000, touch: true },
  { name: 'game-small-landscape', viewport: { width: 667, height: 375 }, query: '/?seed=5&warp=60&auto=1&select=1', wait: 2500, touch: true },
  { name: 'game-request-phone', viewport: { width: 390, height: 844 }, query: '/?seed=11&warp=14', wait: 1500, touch: true, langs: ['he', 'en'] },
  {
    // Taps the plane's bubble (or its edge marker) for every request until one flight has paid.
    name: 'tap-flow-phone',
    viewport: { width: 390, height: 844 },
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
        if (target && target.y > 0 && target.y < 844) {
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
    viewport: { width: 390, height: 844 },
    query: '/?seed=2',
    wait: 1500,
    touch: true,
    actions: async (page) => {
      await page.getByRole('button', { name: /Settings|הגדרות/ }).first().click();
      await page.waitForTimeout(500);
    },
  },
  { name: 'm2-crew-phone', viewport: { width: 390, height: 844 }, query: '/?seed=4&stands=3&crew=1&warp=150&speed=1', wait: 3000, touch: true },
  { name: 'm2-crew-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=6&stands=3&crew=1&warp=210', wait: 3000, touch: true },
  { name: 'm2-staff-panel', viewport: { width: 390, height: 844 }, query: '/?seed=4&money=400&panel=staff', wait: 2000, touch: true },
  { name: 'm3-upgrades-panel', viewport: { width: 390, height: 844 }, query: '/?seed=4&money=3000&panel=upgrades', wait: 2000, touch: true },
  { name: 'm3-progress-landscape', viewport: { width: 844, height: 390 }, query: '/?seed=3&warp=1500&auto=1', wait: 2500, touch: true },
  { name: 'm3-progress-phone', viewport: { width: 390, height: 844 }, query: '/?seed=3&warp=1500&auto=1', wait: 2500, touch: true, langs: ['he'] },
  { name: 'm3-welcome-back', viewport: { width: 390, height: 844 }, query: '/?save=1', wait: 2500, touch: true, save: fixture(2) },
  {
    // plays, autosaves, reloads and checks that the money came back
    name: 'm3-save-reload',
    viewport: { width: 390, height: 844 },
    query: '/?save=1&seed=9&auto=1&warp=400&hook=1',
    wait: 9500,
    touch: true,
    langs: ['en'],
    actions: async (page) => {
      const raw = await page.evaluate(() => localStorage.getItem('skyport.save.v1'));
      if (!raw) throw new Error('no autosave after 11 s');
      const file = JSON.parse(raw);
      if (!(file.v >= 3)) throw new Error('unexpected save version ' + file.v);
      const before = await page.evaluate(() => window.__skyport.stats());
      await page.goto(page.url().replace(/\?.*$/, '?save=1&hook=1'));
      await page.waitForTimeout(2500);
      const after = await page.evaluate(() => window.__skyport.stats());
      if (!(before.money > 0)) throw new Error('nothing earned before saving');
      // the reloaded game continues from the save (plus a little offline pay), not from zero
      if (after.time + 15 < before.time || after.money < before.money * 0.5) throw new Error(`reload lost the game: ${JSON.stringify({ before, after })}`);
      console.log(`     save/reload: before t=${before.time.toFixed(0)} money=${before.money} -> after t=${after.time.toFixed(0)} money=${after.money}`);
    },
  },
  { name: 'm4-team', viewport: { width: 390, height: 844 }, query: '/?seed=4&crew=1&warp=900&auto=1&panel=staff', wait: 2500, touch: true },
  { name: 'm4-applicants', viewport: { width: 390, height: 844 }, query: '/?seed=8&warp=500&money=3000&panel=staff', wait: 2500, touch: true },
  { name: 'gallery-phone', viewport: { width: 390, height: 844 }, query: '/?screen=gallery', wait: 2500, touch: true, langs: ['he'] },
];
