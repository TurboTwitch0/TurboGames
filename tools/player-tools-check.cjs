/* Focused checks for real player Save, Share, fullscreen state, and small layouts. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/player-tools-check.json');
function siteURL(parameters = {}) {
  const url = new URL(site);
  url.search = '';
  url.hash = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const report = { passed: false, site, checks: [], screenshots: [] };
  let api;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true,
      permissions: ['clipboard-read', 'clipboard-write'] });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      // Match the existing hosted checks: inherited proxy, trusted TLS, no bypass.
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
            ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const board = () => page.frameLocator('#game-frame').locator('#board');
    const gameOpen = async () => {
      await page.waitForFunction(() => document.querySelector('#game-dialog').open);
      await board().waitFor({ state: 'visible' });
    };
    const shareClosed = async () => {
      await page.locator('#player-share').waitFor({ state: 'hidden' });
      // A native dialog close hides descendants before its queued close event.
      await page.waitForFunction(() => document.querySelector('#share-game').getAttribute('aria-expanded') === 'false');
      assert.equal(await page.locator('#share-game').getAttribute('aria-expanded'), 'false');
    };
    const noOverflow = async label => {
      const size = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth }));
      assert.ok(size.document <= size.width && size.body <= size.width, label + ': ' + JSON.stringify(size));
    };
    await page.goto(siteURL({ view: 'games', q: 'orbit', sort: 'title-asc', available: '1', embed: '1' }), { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open Orbit Breaker', exact: true }).click();
    await gameOpen();
    const initial = await page.evaluate(() => ({ url: location.href, history: history.length }));
    await page.locator('#save-active-game').click();
    assert.equal(await page.locator('#save-active-game').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites')).includes('orbit-breaker')), true);
    assert.match(await page.locator('#player-save-feedback').textContent(), /saved/);
    assert.deepEqual(await page.evaluate(() => ({ url: location.href, history: history.length })), initial);
    report.checks.push('Player Save updates the real browser-local library and accessible feedback without navigating or adding history');

    await page.locator('#share-game').click();
    assert.equal(await page.locator('#share-game').getAttribute('aria-expanded'), 'true');
    const link = await page.locator('#game-share-link').inputValue();
    assert.equal(link, siteURL({ play: 'orbit-breaker' }));
    assert.equal(await page.locator('#game-share-link').getAttribute('readonly'), '');
    const selectedLink = () => page.locator('#game-share-link').evaluate(node => node === document.activeElement
      && node.selectionStart === 0 && node.selectionEnd === node.value.length);
    assert.equal(await selectedLink(), true);
    await page.locator('#copy-game-link').click();
    await page.waitForFunction(() => document.querySelector('#share-feedback').textContent.startsWith('Link copied'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link, 'Native clipboard should actually contain the shared link');
    assert.deepEqual(await page.evaluate(() => ({ url: location.href, history: history.length })), initial);
    report.checks.push('Share generates only the actual play route; a trusted user click writes that exact link to the real native clipboard');

    // Controlled denial fixture exercises manual recovery without declaring success.
    await page.evaluate(() => {
      window.__turboClipboardWrite = navigator.clipboard.writeText;
      Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('test denial'); } });
    });
    await page.locator('#copy-game-link').click();
    await page.waitForFunction(() => document.querySelector('#share-feedback').textContent.includes('Automatic copying is unavailable'));
    assert.equal(await selectedLink(), true);
    assert.notEqual((await page.locator('#copy-game-link').textContent()).trim(), 'Copied', 'Denied copy must not claim success');
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: window.__turboClipboardWrite }));
    await page.keyboard.press('Escape');
    await shareClosed();
    assert.equal(await page.locator('#game-dialog').evaluate(node => node.open), true);
    assert.equal(await page.locator('#share-game').evaluate(node => node === document.activeElement), true);
    await page.locator('#share-game').click();
    await page.locator('#close-share').click();
    await shareClosed();
    assert.equal(await page.locator('#share-game').evaluate(node => node === document.activeElement), true);
    report.checks.push('A denied clipboard request selects the link with honest recovery; Escape or Close dismisses Share first and restores keyboard focus');

    const sibling = await context.newPage();
    await sibling.goto(siteURL({ view: 'all', q: 'Orbit Breaker' }), { waitUntil: 'domcontentloaded' });
    const siblingSave = sibling.locator('.game-card').filter({ has: sibling.getByRole('button', { name: 'Open Orbit Breaker', exact: true }) }).locator('.save-game');
    await siblingSave.click();
    await page.waitForFunction(() => document.querySelector('#save-active-game').getAttribute('aria-pressed') === 'false');
    await siblingSave.click();
    await page.waitForFunction(() => document.querySelector('#save-active-game').getAttribute('aria-pressed') === 'true');
    await sibling.close();
    report.checks.push('The active game Save button stays synchronized with real favorite changes made in another tab');

    await page.locator('#share-game').click();
    await page.locator('#reload-game').click();
    await shareClosed();
    await board().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#save-active-game').getAttribute('aria-pressed'), 'true');
    await page.locator('#share-game').click();
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    await shareClosed();
    await page.goForward();
    await gameOpen();
    await shareClosed();
    assert.equal(await page.locator('#game-share-link').inputValue(), link);
    const orbitSource = await page.evaluate(() => window.TURBO_CATALOG.find(item => item.id === 'orbit-breaker').source);
    const sourceURL = new URL(orbitSource.split('/').map(encodeURIComponent).join('/'), siteURL()).href;
    let failSource = true;
    await page.route(sourceURL, async route => failSource
      ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'controlled test failure' }) : route.fallback());
    await page.locator('#reload-game').click();
    await page.locator('#player-recovery').waitFor({ state: 'visible' });
    failSource = false;
    await page.locator('#retry-game').click();
    await gameOpen();
    await page.unroute(sourceURL);
    report.checks.push('Restart and Back/Forward reset stale sharing without losing favorites; a controlled failed download recovers through the actual Retry flow');

    for (const [width, height, name] of [[1440, 1000, 'desktop'], [390, 844, 'mobile'], [320, 844, 'narrow'], [667, 375, 'landscape']]) {
      await page.setViewportSize({ width, height });
      await noOverflow(name + ' document');
      const controls = await page.locator('.dialog-actions .icon-button').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      }));
      assert.equal(controls.length, 6);
      for (const control of controls) assert.ok(control.width >= 44 && control.height >= 44
        && control.left >= 0 && control.right <= width && control.top >= 0 && control.bottom <= height, name + ': ' + JSON.stringify(control));
      const layout = await page.evaluate(() => {
        const bar = document.querySelector('.dialog-bar').getBoundingClientRect();
        const frame = document.querySelector('#game-frame').getBoundingClientRect();
        const loading = document.querySelector('#player-loading');
        const recovery = document.querySelector('#player-recovery');
        return { barBottom: bar.bottom, frameTop: frame.top, frameHeight: frame.height,
          toolbar: parseFloat(getComputedStyle(document.querySelector('#player-surface')).getPropertyValue('--player-toolbar-height')),
          barHeight: bar.height, loadingTop: parseFloat(getComputedStyle(loading).top), recoveryTop: parseFloat(getComputedStyle(recovery).top) };
      });
      assert.ok(Math.abs(layout.frameTop - layout.barBottom) < 1, name + ' frame must start after toolbar');
      assert.equal(layout.barHeight, layout.toolbar);
      assert.equal(layout.loadingTop, layout.toolbar);
      assert.equal(layout.recoveryTop, layout.toolbar);
      assert.ok(layout.frameHeight > height * .55, name + ' should leave useful room for the actual game');
      await page.locator('#share-game').click();
      const panel = await page.locator('#player-share').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width && panel.y >= 0 && panel.y + panel.height <= height,
        name + ' share panel must fit');
      await page.locator('#close-share').click();
      const screenshot = '/tmp/turbogames-player-tools-' + name + '.png';
      await page.screenshot({ path: screenshot });
      report.screenshots.push(screenshot);
    }
    report.checks.push('Six 44px controls, consistent toolbar/frame/recovery offsets, usable game space, and sharing fit desktop,390px,320px,and landscape screens');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#fullscreen-button').click();
    if (await page.evaluate(() => Boolean(document.fullscreenElement))) {
      await page.waitForFunction(() => document.querySelector('#fullscreen-button').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#fullscreen-button').getAttribute('aria-label'), 'Exit fullscreen');
      assert.equal(await page.locator('#fullscreen-button').getAttribute('title'), 'Exit fullscreen');
      await page.locator('#fullscreen-button').click();
      await page.waitForFunction(() => !document.fullscreenElement
        && document.querySelector('#fullscreen-button').getAttribute('aria-pressed') === 'false');
      assert.equal(await page.locator('#fullscreen-button').getAttribute('aria-label'), 'Go fullscreen');
    } else {
      assert.match(await page.locator('#player-status').textContent(), /Fullscreen is blocked/);
      assert.equal(await page.locator('#open-game-tab').evaluate(node => node === document.activeElement), true);
    }
    report.checks.push('Fullscreen label, icon state, and pressed state track the actual API and revert on exit; blocked fullscreen retains the new-tab recovery');

    const missing = await page.evaluate(() => window.TURBO_CATALOG.find(item => item.sourceStatus === 'unavailable').id);
    await page.goto(siteURL({ play: missing }), { waitUntil: 'domcontentloaded' });
    await page.locator('#player-recovery').waitFor({ state: 'visible' });
    await page.locator('#save-active-game').click();
    assert.equal(await page.locator('#save-active-game').getAttribute('aria-pressed'), 'true');
    await page.locator('#share-game').click();
    assert.equal(new URL(await page.locator('#game-share-link').inputValue()).searchParams.get('play'), missing);
    await page.keyboard.press('Escape');
    await shareClosed();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !new URL(location.href).searchParams.has('play'));
    assert.deepEqual(errors, []);
    report.checks.push('Known missing-source recovery still offers real Save and Share without pretending the game works; the next Escape closes the player and clears the direct play route');
    report.passed = true;
  } catch (error) {
    report.error = error.stack || String(error);
    throw error;
  } finally {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    await api?.dispose();
    await browser.close();
  }
  console.log(JSON.stringify(report));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
