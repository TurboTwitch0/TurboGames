/* Focused Chromium checks for the restored homepage and its library shortcuts. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || 'reports/restored-home-check.json';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const report = { passed: false, site, checks: [] };
  let api;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, hasTouch: true, reducedMotion: 'reduce' });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        try {
          const response = await api.fetch(route.request().url(), { headers: route.request().headers(), failOnStatusCode: false });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ribbon = page.locator('#feature-ribbon');
    const orbit = page.getByRole('button', { name: 'Open Orbit Breaker', exact: true });
    const go = async (query = '') => {
      const url = new URL(site);
      url.search = query;
      url.hash = '';
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#result-count')?.textContent);
    };
    const view = () => new URL(page.url()).searchParams.get('view');
    const active = selector => page.locator(selector).evaluate(node => node === document.activeElement);

    await go();
    await ribbon.waitFor({ state: 'visible' });
    const total = (await page.locator('#total-titles').textContent()).replace(/\D/g, '');
    assert.equal(Number(total), await page.evaluate(() => window.TURBO_CATALOG.length));
    const description = page.locator('#featured-description');
    const firstDescription = (await description.textContent()).trim();
    assert.ok(firstDescription);
    assert.equal(await description.isVisible(), true);
    const status = page.locator('#featured-status');
    assert.ok((await status.boundingBox())?.width > 1, 'Position indicator is visible, not screen-reader only');
    assert.match(await status.textContent(), /1 of 3/);
    await page.getByRole('button', { name: 'Show Little Match', exact: true }).click();
    assert.notEqual((await description.textContent()).trim(), firstDescription);
    assert.match(await status.textContent(), /2 of 3/);
    assert.equal((await page.locator('#featured-title').textContent()).trim(), 'Little Match');
    await page.getByRole('button', { name: 'Show Orbit Breaker', exact: true }).click();
    assert.equal((await description.textContent()).trim(), firstDescription);
    report.checks.push('Real catalog total and visible featured position and description reflect the homepage and currently selected game');

    await page.locator('#hero-save').click();
    await page.waitForFunction(() => document.querySelector('#hero-save').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'true');
    await page.locator('#hero-saved').focus();
    await page.keyboard.press('Enter');
    assert.equal(view(), 'saved');
    assert.equal(await active('.tab[data-category="saved"]'), true);
    await orbit.waitFor({ state: 'visible' });
    await ribbon.waitFor({ state: 'hidden' });
    await go();
    await page.locator('#ribbon-saved').click();
    assert.equal(view(), 'saved');
    await orbit.waitFor({ state: 'visible' });
    report.checks.push('Hero and ribbon Saved actions open the real library with the actual saved game and visible tab focus');

    await go();
    await page.locator('#ribbon-search').click();
    assert.equal(view(), 'all');
    assert.equal(await active('#search'), true);
    await page.keyboard.insertText('Orbit Breaker');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'Orbit Breaker');
    await orbit.click();
    const board = page.frameLocator('#game-frame').locator('#board');
    await board.waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).searchParams.get('play'), 'orbit-breaker');
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    await page.goForward();
    await board.waitFor({ state: 'visible' });
    await go();
    await page.locator('#ribbon-recent').click();
    assert.equal(view(), 'recent');
    await orbit.waitFor({ state: 'visible' });
    report.checks.push('Ribbon search directs typing to the real search and game launch, Back/Forward, and Recent remain connected');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await go();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
      for (const id of ['hero-saved', 'ribbon-search', 'ribbon-saved', 'ribbon-recent']) {
        const box = await page.locator('#' + id).boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1,
          `${id} has a visible touch target at ${width}px`);
      }
      await page.locator('#ribbon-recent').tap();
      assert.equal(view(), 'recent');
      await orbit.waitFor({ state: 'visible' });
    }
    for (const query of ['view=all&q=orbit', 'embed=1']) {
      await go(query);
      await ribbon.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
    report.checks.push('Responsive shortcuts fit and respond to touch at 320px and 390px and stay out of filtered and embedded views');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    if (api) await api.dispose();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
