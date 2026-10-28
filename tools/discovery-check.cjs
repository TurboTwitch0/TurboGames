/* Focused regression checks for the existing arcade's discovery and player flows. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/discovery-check.json');
const mobileScreenshot = '/tmp/turbogames-discovery-mobile.png';

function siteURL(parameters = {}) {
  const url = new URL(site);
  url.search = '';
  url.hash = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const checks = [];
  const report = { passed: false, site, checks };
  let api;
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      // Use the environment's trusted HTTP client for hosted checks, matching
      // browser-check.cjs; keep proxy routing and TLS verification enabled.
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await page.context().route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(), ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const tab = category => page.locator('.tab[data-category="' + category + '"]');
    const orbitButton = () => page.getByRole('button', { name: 'Open Orbit Breaker', exact: true });
    const orbitCard = () => page.locator('.game-card').filter({ has: orbitButton() });
    const board = () => page.frameLocator('#game-frame').locator('#board');
    const waitForDialog = open => page.waitForFunction(
      expected => document.querySelector('#game-dialog').open === expected, open
    );
    const closePlayer = async () => {
      await page.locator('#close-dialog').click();
      await waitForDialog(false);
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('play'));
    };
    const openOrbit = async () => {
      await orbitButton().click();
      await waitForDialog(true);
      await page.waitForFunction(() => new URL(location.href).searchParams.get('play') === 'orbit-breaker');
      await board().waitFor({ state: 'visible' });
    };
    const searchOrbit = async () => {
      await page.locator('#search').fill('ORBIT... BREAKER!');
      await orbitButton().waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelectorAll('.card-launch').length === 1);
    };
    const waitForScopedResults = (category, query) => page.waitForFunction(({ category, query }) => {
      const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const tokens = normalize(query).split(/\s+/).filter(Boolean);
      const hideUnavailable = document.querySelector('#hide-unavailable').checked;
      const expected = window.TURBO_CATALOG.filter(item => item.category === category
        && (!hideUnavailable || item.sourceStatus !== 'unavailable')
        && tokens.every(token => normalize([item.title, item.category, ...(item.tags || [])].join(' ')).includes(token)));
      const titles = new Set(expected.map(item => 'Open ' + item.title));
      const actual = [...document.querySelectorAll('.card-launch')];
      return actual.length === Math.min(expected.length, 96)
        && actual.every(button => titles.has(button.getAttribute('aria-label')));
    }, { category, query });

    await page.goto(siteURL(), { waitUntil: 'domcontentloaded' });
    await page.locator('.card-launch').first().waitFor({ state: 'visible' });
    await tab('games').click();
    await page.locator('#search').fill('mario');
    await waitForScopedResults('games', 'mario');
    await tab('flash').click();
    assert.equal(await page.locator('#search').inputValue(), 'mario');
    await waitForScopedResults('flash', 'mario');
    await tab('games').click();
    assert.equal(await page.locator('#search').inputValue(), 'mario');
    await waitForScopedResults('games', 'mario');
    checks.push('Search stays scoped to the selected category and survives tab changes');

    await searchOrbit();
    assert.equal(await orbitButton().count(), 1);
    checks.push('Multiword search tolerates capitalization and punctuation');

    const save = orbitCard().locator('.save-game');
    assert.equal(await save.getAttribute('aria-pressed'), 'false');
    await save.click();
    await page.waitForFunction(() => document.querySelector('.save-game')?.getAttribute('aria-pressed') === 'true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await tab('saved').click();
    await searchOrbit();
    assert.equal(await orbitCard().locator('.save-game').getAttribute('aria-pressed'), 'true');
    checks.push('Saved games persist after reload and appear in the Saved collection');

    await openOrbit();
    await page.evaluate(() => history.back());
    await waitForDialog(false);
    assert.equal(new URL(page.url()).searchParams.has('play'), false);
    await page.evaluate(() => history.forward());
    await waitForDialog(true);
    await board().waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).searchParams.get('play'), 'orbit-breaker');
    await closePlayer();
    await tab('recent').click();
    await searchOrbit();
    assert.equal(await orbitButton().count(), 1);
    checks.push('Launch updates the URL; Back closes, Forward reopens, and Recent records the game');

    await page.goto(siteURL({ play: 'orbit-breaker' }), { waitUntil: 'domcontentloaded' });
    await waitForDialog(true);
    await board().waitFor({ state: 'visible' });
    await closePlayer();
    checks.push('Closing a direct game link removes its play parameter');

    await page.goto(siteURL({ view: 'games', q: 'Orbit Breaker' }), { waitUntil: 'domcontentloaded' });
    await orbitButton().waitFor({ state: 'visible' });
    await page.route('**/games/orbit-breaker.html', route => route.abort('failed'));
    await orbitButton().click();
    await page.locator('#player-recovery').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#retry-game').isVisible(), true);
    await page.unroute('**/games/orbit-breaker.html');
    await page.locator('#retry-game').click();
    await board().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#player-recovery').isVisible(), false);
    await closePlayer();
    checks.push('A failed game download shows recovery and Retry opens the playable original');

    const missing = await page.evaluate(() =>
      window.TURBO_CATALOG.find(item => item.sourceStatus === 'unavailable')
    );
    if (missing) {
      await page.goto(siteURL({ view: 'all', q: missing.title }), { waitUntil: 'domcontentloaded' });
      const unavailable = page.locator('.source-unavailable').filter({
        has: page.getByRole('button', { name: 'Open ' + missing.title, exact: true })
      }).locator('.card-launch');
      await unavailable.waitFor({ state: 'visible' });
      await page.locator('#hide-unavailable').check();
      await page.waitForFunction(() => document.querySelectorAll('#game-grid .source-unavailable').length === 0);
      await page.locator('#hide-unavailable').uncheck();
      await unavailable.waitFor({ state: 'visible' });
      await unavailable.click();
      await page.locator('#player-recovery').waitFor({ state: 'visible' });
      assert.match(await page.locator('#recovery-title').textContent(), /source/i);
      assert.ok((await page.locator('#recovery-description').textContent()).trim().length > 10);
      assert.equal(await page.locator('#retry-game').isVisible(), false);
      await closePlayer();
      checks.push('Hide unavailable filters known missing sources; opening one explains the issue without a futile retry');
    }

    await page.goto(siteURL({ view: 'apps' }), { waitUntil: 'domcontentloaded' });
    await page.locator('.card-launch').first().waitFor({ state: 'visible' });
    for (const direction of ['title-asc', 'title-desc']) {
      await page.locator('#sort').selectOption(direction);
      await page.waitForFunction(direction => {
        const titles = [...document.querySelectorAll('#game-grid .card-launch')].map(node =>
          node.getAttribute('aria-label').replace(/^Open /, '')
        );
        const sorted = [...titles].sort((a, b) =>
          (direction === 'title-asc' ? 1 : -1) * a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
        return titles.length > 1 && JSON.stringify(titles) === JSON.stringify(sorted);
      }, direction);
      assert.equal(new URL(page.url()).searchParams.get('sort'), direction);
    }
    checks.push('A–Z and Z–A sorting reorder the Apps collection and remain in the shareable URL');

    // Seed an older durable save, then fail only the parent save bridge writes.
    // The original game's localStorage adapter should still accept current values.
    await page.goto(siteURL(), { waitUntil: 'domcontentloaded' });
    await page.locator('.card-launch').first().waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const key = 'turbogames:save:orbit-breaker';
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      existing['turbo-discovery-quota'] = 'stale';
      localStorage.setItem(key, JSON.stringify(existing));
      const original = Storage.prototype.setItem;
      window.__turboQuotaFailures = 0;
      Storage.prototype.setItem = function (storageKey, value) {
        if (String(storageKey).startsWith('turbogames:save:')) {
          window.__turboQuotaFailures++;
          throw new DOMException('Quota reached for focused regression check', 'QuotaExceededError');
        }
        return original.call(this, storageKey, value);
      };
    });
    await tab('games').click();
    await searchOrbit();
    await openOrbit();
    await board().evaluate(() => localStorage.setItem('turbo-discovery-quota', 'current'));
    await page.waitForFunction(() => window.__turboQuotaFailures > 0);
    const previousSource = await page.locator('#game-frame').getAttribute('srcdoc');
    await page.locator('#reload-game').click();
    await page.waitForFunction(previous => {
      const source = document.querySelector('#game-frame')?.getAttribute('srcdoc');
      return Boolean(source && source !== previous);
    }, previousSource);
    await board().waitFor({ state: 'visible' });
    assert.equal(await board().evaluate(() => localStorage.getItem('turbo-discovery-quota')), 'current');
    await closePlayer();
    await openOrbit();
    assert.equal(await board().evaluate(() => localStorage.getItem('turbo-discovery-quota')), 'current');
    await closePlayer();
    checks.push('A storage quota failure keeps the latest in-memory game save on restart and reopen');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(siteURL(), { waitUntil: 'domcontentloaded' });
    await page.locator('.card-launch').first().waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await tab('games').click();
    await searchOrbit();
    await openOrbit();
    const controls = await page.locator('.dialog-actions a, .dialog-actions button').evaluateAll(nodes =>
      nodes.map(node => {
        const bounds = node.getBoundingClientRect();
        return { label: node.getAttribute('aria-label'), width: bounds.width, height: bounds.height };
      })
    );
    assert.ok(controls.length >= 4, 'Expected the player action controls');
    for (const control of controls) {
      assert.ok(control.width >= 44 && control.height >= 44,
        control.label + ' needs a minimum 44px touch target: ' + JSON.stringify(control));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await closePlayer();
    await page.screenshot({ path: mobileScreenshot, fullPage: false });
    checks.push('The 390px mobile layout has no horizontal overflow and player controls are at least 44px');
    assert.deepEqual(pageErrors, [], 'Primary discovery/player flows must not throw browser errors');
    report.passed = true;
    report.screenshot = mobileScreenshot;
    console.log(JSON.stringify(report));
  } catch (error) {
    report.error = error.stack || error.message;
    throw error;
  } finally {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    await api?.dispose();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
