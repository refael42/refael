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
  { name: 'gallery-phone', viewport: { width: 390, height: 844 }, query: '/?screen=gallery', wait: 2500, touch: true, langs: ['he'] },
];
