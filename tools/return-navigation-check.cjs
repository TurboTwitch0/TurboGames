/* Real-browser regressions for returning from the player and native link actions. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const url = query => { const value = new URL(site); value.search = query; return value.href; };
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const checks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const go = async query => {
      await page.goto(url(query), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(document.querySelector('#result-count').textContent));
    };
    const open = async target => {
      await target.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#game-dialog').open);
    };
    const close = async () => {
      await page.locator('#close-dialog').click();
      await page.waitForFunction(() => !document.querySelector('#game-dialog').open && document.activeElement !== document.body);
    };
    const activeGame = () => page.evaluate(() => document.activeElement.closest('.game-card')?.dataset.gameId);
    await go('view=all&q=Orbit+Breaker');
    await open(page.locator('.card-launch').first());
    await close();
    assert.equal(await activeGame(), 'orbit-breaker');
    await page.goForward();
    await page.waitForFunction(() => document.querySelector('#game-dialog').open);
    await close();
    assert.equal(await activeGame(), 'orbit-breaker');
    checks.push('Close and browser Forward/Close return focus to the recreated catalog launcher');

    await go('view=all');
    await page.locator('#load-more').click();
    const deepId = await page.locator('.game-card').nth(150).getAttribute('data-game-id');
    await open(page.locator('.game-card').nth(150).locator('.card-launch'));
    await close();
    assert.equal(await activeGame(), deepId);
    assert.equal(await page.locator('.game-card').count(), 192);
    await page.waitForFunction(() => {
      const bounds = document.activeElement.getBoundingClientRect();
      return bounds.y >= 0 && bounds.bottom <= innerHeight + 1;
    });
    checks.push('Returning from a later page preserves 192 loaded cards and the visible originating title');

    await go('view=all&q=Orbit+Breaker');
    await page.evaluate(() => localStorage.setItem('turbogames:favorites', JSON.stringify(['orbit-breaker'])));
    await go('view=saved');
    await open(page.locator('.card-launch'));
    await page.locator('#save-active-game').click();
    await page.waitForFunction(() => document.querySelector('#save-active-game').getAttribute('aria-pressed') === 'false');
    await close();
    assert.equal(await page.locator('#clear-search').evaluate(node => node === document.activeElement), true);
    checks.push('Unsave inside the player returns an emptied Saved collection to Browse all');

    await go('');
    await open(page.locator('#hero-play'));
    await close();
    assert.equal(await page.locator('#hero-play').evaluate(node => node === document.activeElement), true);
    await go('view=all&q=Orbit+Breaker');
    await page.locator('#pick-game').click();
    await open(page.locator('#pick-play'));
    await close();
    assert.equal(await page.locator('#pick-game').evaluate(node => node === document.activeElement), true);
    await page.evaluate(() => localStorage.setItem('turbogames:favorites', JSON.stringify(['orbit-breaker'])));
    await go('view=saved');
    await page.locator('#pick-game').click();
    await open(page.locator('#pick-play'));
    await page.locator('#save-active-game').click();
    await page.waitForFunction(() => document.querySelector('#save-active-game').getAttribute('aria-pressed') === 'false');
    await close();
    assert.equal(await page.locator('#clear-search').evaluate(node => node === document.activeElement), true);
    checks.push('Featured and quick-pick controls recover focus, including Browse all when the last Saved pick was removed');

    await go('view=all&q=Orbit+Breaker');
    const original = page.url();
    for (const selector of ['a.brand', '#hero-starters']) {
      for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
        const prevented = await page.locator(selector).first().evaluate((node, modifier) => {
          const event = new MouseEvent('click', { [modifier]: true, bubbles: true, cancelable: true });
          // Check the app handler while suppressing the browser's real default navigation.
          let prevented;
          const suppress = last => { prevented = last.defaultPrevented; last.preventDefault(); };
          document.addEventListener('click', suppress, { once: true });
          node.dispatchEvent(event);
          return prevented;
        }, modifier);
        assert.equal(prevented, false, `${selector} ${modifier}`);
        assert.equal(page.url(), original);
      }
    }
    await go('');
    await page.locator('#hero-starters').click();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'starters');
    await page.locator('a.brand').first().click();
    assert.equal(new URL(page.url()).search, '');
    checks.push('Modified Home and Start here links keep native behavior; ordinary clicks still update the collection');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await go('view=all&q=Orbit+Breaker');
      await open(page.locator('.card-launch').first());
      await close();
      assert.equal(await activeGame(), 'orbit-breaker');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    checks.push('Player return focus works at 390px and 320px with no page overflow');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, site, checks }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
