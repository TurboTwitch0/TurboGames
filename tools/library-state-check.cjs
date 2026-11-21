/* Real-browser regressions for durable favorites and collection keyboard focus. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/library-state-check.json');
const key = 'turbogames:favorites';
const orbit = 'orbit-breaker';
const match = 'little-match';
const puzzle = 'library-source/html5-games/cl2048.html';
const url = query => { const result = new URL(site); result.search = query; result.hash = ''; return result.href; };
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').sort(), key);
const saveButton = (page, id) => page.locator('.game-card').filter({ has: page.locator(`[data-save-id="${id}"]`) }).locator('.save-game');
async function go(page, query = 'view=all') {
  await page.goto(url(query), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#result-count')?.textContent);
}
async function toggle(page, id, expected) {
  const button = saveButton(page, id);
  await button.click();
  await page.waitForFunction(({ id, expected }) =>
    document.querySelector(`.game-card [data-save-id="${id}"]`)?.getAttribute('aria-pressed') === String(expected), { id, expected });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const report = { passed: false, site, checks: [] };
  const errors = [];
  const contexts = [];
  const makeContext = async init => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    contexts.push(context);
    context.on('page', page => { page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message)); });
    if (init) await context.addInitScript(init);
    return context;
  };
  try {
    const context = await makeContext();
    const page = await context.newPage();
    await go(page);
    await page.evaluate(({ key, orbit, match }) => localStorage.setItem(key, JSON.stringify([orbit, match])), { key, orbit, match });
    await go(page, 'view=saved');
    await saveButton(page, orbit).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.game-card [data-save-id="orbit-breaker"]'));
    assert.equal(await saveButton(page, match).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#clear-search').evaluate(node => node === document.activeElement), true);
    report.checks.push('Keyboard Unsave focuses the next surviving card, then the empty-state Browse all action');

    await go(page);
    const loaded = await page.locator('.game-card').count();
    assert.equal(loaded, 96);
    await page.locator('#load-more').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.game-card').count(), 192);
    assert.equal(await page.locator('.game-card').nth(loaded).locator('.card-launch').evaluate(node => node === document.activeElement), true);
    const focusedBounds = await page.locator('.game-card').nth(loaded).locator('.card-launch').boundingBox();
    assert.ok(focusedBounds.y >= 0 && focusedBounds.y + focusedBounds.height <= 900);
    const many = await page.evaluate(() => window.TURBO_CATALOG.slice(0, 220).map(item => item.id));
    await page.evaluate(({ key, many }) => localStorage.setItem(key, JSON.stringify(many)), { key, many });
    await go(page, 'view=saved');
    await page.locator('#load-more').click();
    const lateSave = page.locator('.game-card').nth(150).locator('.save-game');
    const lateId = await lateSave.getAttribute('data-save-id');
    await lateSave.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => !document.querySelector(`.game-card [data-save-id="${id}"]`), lateId);
    assert.equal(await page.locator('.game-card').count(), 192);
    assert.equal(await page.locator('.game-card').nth(150).locator('.save-game').evaluate(node => node === document.activeElement), true);
    const retainedId = await page.locator('.game-card').nth(150).getAttribute('data-game-id');
    const focusPeer = await context.newPage();
    await go(focusPeer, 'view=all&q=Orbit+Breaker');
    await focusPeer.evaluate(({ key, removedId }) => localStorage.setItem(key,
      JSON.stringify(JSON.parse(localStorage.getItem(key)).filter(id => id !== removedId))), { key, removedId: many[0] });
    await page.waitForFunction(() => document.querySelector('#saved-count').textContent === '218');
    assert.equal(await page.locator('.game-card').count(), 192);
    assert.equal(await page.locator(`[data-game-id="${retainedId}"] .save-game`).evaluate(node => node === document.activeElement), true);
    await focusPeer.close();
    report.checks.push('Show more reveals and focuses the next page; Saved mutations keep the loaded window and deep keyboard position');

    const peer = await context.newPage();
    await peer.addInitScript(() => {
      const original = window.addEventListener;
      window.addEventListener = function(type, ...args) {
        if (type !== 'storage') return original.call(this, type, ...args);
      };
    });
    await page.evaluate(key => localStorage.removeItem(key), key);
    await go(page, 'view=all&q=Orbit+Breaker');
    await go(peer, 'view=all&q=Little+Match');
    await toggle(page, orbit, true);
    await toggle(peer, match, true);
    assert.deepEqual(await saved(peer), [match, orbit].sort());
    await toggle(peer, match, false);
    assert.deepEqual(await saved(peer), [orbit]);
    report.checks.push('A stale tab with delayed storage notifications merges saves and removals instead of discarding another tab’s favorites');

    await peer.close();
    const concurrent = await context.newPage();
    await page.evaluate(key => localStorage.removeItem(key), key);
    await go(page, 'view=all&q=Orbit+Breaker');
    await go(concurrent, 'view=all&q=Little+Match');
    assert.equal(await page.evaluate(() => Boolean(navigator.locks?.request)), true);
    await Promise.all([toggle(page, orbit, true), toggle(concurrent, match, true)]);
    assert.deepEqual(await saved(page), [match, orbit].sort());
    await page.waitForFunction(() => document.querySelector('[data-library-count="saved"]').textContent === '2');
    report.checks.push('Two tabs saving concurrently serialize native Web Lock writes and synchronize the real Saved count');

    await page.evaluate(key => localStorage.removeItem(key), key);
    await go(page, 'view=all&q=Orbit+Breaker');
    await saveButton(page, orbit).evaluate(async button => {
      button.click(); button.click(); button.click(); button.click();
      await navigator.locks.request('turbogames:favorites', () => {});
    });
    assert.equal(await saveButton(page, orbit).getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await saved(page), []);
    report.checks.push('Rapid repeated heart clicks retain their alternating intent while writes are queued');

    const deniedContext = await makeContext(() => {
      window.testDenyStorage = false;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (window.testDenyStorage && key === 'turbogames:favorites') throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return original.call(this, key, value);
      };
      Object.defineProperty(navigator, 'locks', { value: { request: () => Promise.reject(new DOMException('Denied', 'SecurityError')) } });
    });
    const denied = await deniedContext.newPage();
    await go(denied, 'view=all&q=Orbit+Breaker');
    await toggle(denied, orbit, true);
    await denied.evaluate(() => { window.testDenyStorage = true; });
    await toggle(denied, orbit, false);
    await denied.locator('#search').fill('Little Match');
    await saveButton(denied, match).waitFor({ state: 'visible' });
    await toggle(denied, match, true);
    assert.match(await denied.locator('#library-note').textContent(), /last for this tab/);
    await denied.locator('#header-saved').click();
    assert.equal(await saveButton(denied, orbit).count(), 0);
    assert.equal(await saveButton(denied, match).count(), 1);
    assert.deepEqual(await saved(denied), [orbit]);
    await denied.getByRole('button', { name: 'Open Little Match', exact: true }).click();
    await denied.waitForFunction(() => JSON.parse(localStorage.getItem('turbogames:recent') || '[]').includes('little-match'));
    assert.match(await denied.locator('#library-note').textContent(), /last for this tab/);
    await denied.locator('#close-dialog').click();
    await denied.evaluate(() => { window.testDenyStorage = false; });
    await denied.locator('.tab[data-category="all"]').click();
    await denied.locator('#search').fill('2048');
    await saveButton(denied, puzzle).waitFor({ state: 'visible' });
    await toggle(denied, puzzle, true);
    assert.deepEqual(await saved(denied), [match, puzzle].sort());
    assert.equal(await denied.locator('#library-note').textContent(), '');
    report.checks.push('Denied Web Locks fall back safely; quota-failed saves/removals survive filtering, merge on recovery, and clear the stale warning');

    const blockedContext = await makeContext(() => {
      Object.defineProperty(navigator, 'locks', { value: undefined });
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const blocked = await blockedContext.newPage();
    await go(blocked, 'view=all&q=Orbit+Breaker');
    await toggle(blocked, orbit, true);
    await blocked.locator('#header-saved').click();
    assert.equal(await saveButton(blocked, orbit).count(), 1);
    await blocked.locator('#search').fill('Orbit');
    assert.equal(await saveButton(blocked, orbit).getAttribute('aria-pressed'), 'true');
    report.checks.push('Fully blocked browser storage and an absent Lock API still allow a tab-local Saved collection');

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(({ key, orbit, match }) => localStorage.setItem(key, JSON.stringify([orbit, match])), { key, orbit, match });
    await go(page, 'view=saved');
    await saveButton(page, orbit).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.game-card [data-save-id="orbit-breaker"]'));
    const narrowFocus = await saveButton(page, match).boundingBox();
    assert.ok(narrowFocus.x >= 0 && narrowFocus.x + narrowFocus.width <= 320 && narrowFocus.y >= 100 && narrowFocus.y + narrowFocus.height <= 844);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/turbogames-library-state-mobile.png' });
    assert.deepEqual(errors, []);
    report.checks.push('Focus recovery stays visible below the sticky mobile header at 320px without horizontal overflow or runtime errors');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
