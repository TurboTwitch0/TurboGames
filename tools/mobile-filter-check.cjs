/* Mobile discovery checks use the real catalog, controls, and native dialogs. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const output = process.env.TURBO_REPORT_PATH || 'reports/mobile-filter-check.json';
const siteURL = values => {
  const url = new URL(site); url.search = ''; url.hash = '';
  for (const [key, value] of Object.entries(values || {})) url.searchParams.set(key, value);
  return url.href;
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let api;
  const report = { passed: false, site, method: 'Actual native-dialog, touch, keyboard and existing-game browser checks. Before-row positions were captured locally before this change.', checks: [], firstCards: [], screenshots: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        try {
          const incoming = route.request();
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
            ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response }); await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sheet = page.locator('#mobile-filter-dialog');
    const opener = page.locator('#open-mobile-filters');
    const go = async params => {
      await page.goto(siteURL(params), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(document.querySelector('#result-count')?.textContent));
    };
    const open = async touch => {
      await (touch ? opener.tap() : opener.click());
      await page.waitForFunction(() => document.querySelector('#mobile-filter-dialog').open);
      assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    };
    const closedWithFocus = async () => {
      await page.waitForFunction(() => !document.querySelector('#mobile-filter-dialog').open
        && document.activeElement === document.querySelector('#open-mobile-filters'));
      assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    };
    const activeParams = async expected => {
      const actual = Object.fromEntries(new URL(page.url()).searchParams);
      for (const [key, value] of Object.entries(expected)) assert.equal(actual[key] || null, value, key);
    };
    const noOverflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
    const targets = async selectors => {
      for (const selector of selectors) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, selector + ' needs a 44px target');
      }
    };

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await go({ view: 'starters' });
      await page.locator('.game-card').first().waitFor();
      await page.waitForTimeout(400);
      await targets(['#open-mobile-filters']);
      assert.equal(await sheet.evaluate(node => node.open), false);
      assert.equal(await page.locator('#genre-filters').isVisible(), false);
      assert.equal(await page.locator('#sort').isVisible(), false);
      for (const selector of ['#genre-filters', '#sort', '#hide-unavailable']) assert.equal(await page.locator(selector).count(), 1);
      const first = await page.locator('.game-card').first().evaluate(node => {
        const box = node.getBoundingClientRect(); return { y: box.y, bottom: box.bottom, height: box.height, viewport: innerHeight };
      });
      report.firstCards.push({ width, ...first });
      assert.ok(first.y >= 0 && first.bottom <= 845, width + 'px should show the complete first starter-game row: ' + JSON.stringify(first));
      await noOverflow(width + 'px starter collection');
      const path = '/tmp/turbo-mobile-filters-after-' + width + '.png';
      await page.screenshot({ path, animations: 'disabled' }); report.screenshots.push(path);
    }
    if (fs.existsSync('/tmp/turbo-mobile-filters-baseline.json')) report.baseline = JSON.parse(fs.readFileSync('/tmp/turbo-mobile-filters-baseline.json', 'utf8'));
    report.checks.push('Phone starters show the complete first game row at 390px and 320px; one-copy filters stay in a closed native sheet until requested');

    await open(true);
    await targets(['#close-mobile-filters', '#reset-mobile-filters', '#apply-mobile-filters']);
    assert.equal(await page.locator('#genre-filters').evaluate(node => document.querySelector('#mobile-filter-content').contains(node)), true);
    assert.equal(await page.locator('#sort').evaluate(node => document.querySelector('#mobile-filter-content').contains(node)), true);
    await page.locator('#genre-filters [data-genre=puzzle]').tap();
    await page.locator('#sort').selectOption('title-desc');
    await page.locator('#hide-unavailable').check();
    await activeParams({ view: 'starters', genre: 'puzzle', sort: 'title-desc', available: '1' });
    const total = (await page.locator('#result-count').textContent()).match(/[\d,]+/)[0];
    assert.ok((await page.locator('#mobile-filter-results').textContent()).includes(total));
    assert.ok((await page.locator('#apply-mobile-filters').textContent()).includes(total));
    await page.locator('#apply-mobile-filters').tap();
    await closedWithFocus();
    assert.equal(await page.locator('#sort').inputValue(), 'title-desc');
    assert.equal(await page.locator('#hide-unavailable').isChecked(), true);
    await go({ view: 'games', q: 'orbit', genre: 'arcade', sort: 'title-desc', available: '1' });
    await open(true);
    await page.locator('#reset-mobile-filters').tap();
    await activeParams({ view: 'games', q: 'orbit', genre: null, sort: null, available: null });
    assert.equal(await sheet.evaluate(node => node.open), true);
    await page.locator('#apply-mobile-filters').tap(); await closedWithFocus();
    report.checks.push('Touch selections immediately update genre/sort/availability and honest result counts; Apply closes, and Reset preserves the current search and collection');

    await go({ view: 'starters' });
    await page.keyboard.press('Tab'); await opener.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#mobile-filter-dialog').open);
    for (let i = 0; i < 23; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await sheet.evaluate(node => node.contains(document.activeElement)), true, 'Tab stays inside the modal');
    }
    for (let i = 0; i < 17; i++) {
      await page.keyboard.press('Shift+Tab');
      assert.equal(await sheet.evaluate(node => node.contains(document.activeElement)), true, 'Reverse Tab stays inside the modal');
    }
    await page.locator('#close-mobile-filters').focus();
    await page.keyboard.press('/');
    assert.equal(await sheet.evaluate(node => node.contains(document.activeElement)), true, 'Slash must not focus the inert background search');
    await page.keyboard.press('Escape'); await closedWithFocus();
    assert.equal(await opener.evaluate(node => node.matches(':focus-visible') && parseFloat(getComputedStyle(node).outlineWidth) > 0), true);
    assert.equal(await page.locator('#game-dialog').evaluate(node => node.open), false);
    await open(false); await page.locator('#close-mobile-filters').click(); await closedWithFocus();
    report.checks.push('Keyboard opens the native modal, Tab/ShiftTab stay inside, Slash cannot escape, and Escape/Close restore visible opener focus');

    await go({ view: 'all', genre: 'puzzle', sort: 'title-desc', available: '1' });
    for (const key of ['genre', 'sort', 'available']) {
      await page.locator('#active-filters [data-filter=' + key + ']').click();
      await page.waitForFunction(() => document.activeElement === document.querySelector('#open-mobile-filters'));
    }
    await activeParams({ view: 'all', genre: null, sort: null, available: null });
    await go({ view: 'games', q: 'orbit' });
    await page.locator('#active-filters [data-filter=q]').click();
    assert.equal(await page.locator('#search').evaluate(node => node === document.activeElement), true);
    report.checks.push('Removing main-page filter chips focuses the visible filter opener; clearing the search still focuses the search field');

    await go({ view: 'starters' }); await open(false);
    await page.locator('#genre-filters [data-genre=puzzle]').click();
    await page.locator('#sort').selectOption('title-desc'); await page.locator('#sort').focus();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForFunction(() => !document.querySelector('#mobile-filter-dialog').open
      && !document.querySelector('#mobile-filter-content').contains(document.querySelector('#sort')));
    assert.equal(await opener.isVisible(), false);
    assert.equal(await page.locator('#genre-filters').evaluate(node => Boolean(node.closest('.collection-content'))), true);
    assert.equal(await page.locator('#sort').evaluate(node => Boolean(node.closest('.collection-toolbar'))), true);
    await page.waitForFunction(() => document.activeElement === document.querySelector('#sort'));
    await activeParams({ view: 'starters', genre: 'puzzle', sort: 'title-desc' });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.waitForFunction(() => document.querySelector('#mobile-filter-content').contains(document.querySelector('#sort')));
    assert.equal(await sheet.evaluate(node => node.open), false);
    await page.waitForFunction(() => document.activeElement === document.querySelector('#open-mobile-filters'));
    assert.equal(await page.locator('#sort').inputValue(), 'title-desc');
    report.checks.push('Widening closes and restores the original single controls with focused Sort and selected values; shrinking closes the sheet and focuses its visible opener');

    await go({ view: 'starters' }); await open(false);
    await page.locator('#genre-filters [data-genre=arcade]').click();
    await page.locator('#apply-mobile-filters').click(); await closedWithFocus();
    const orbit = page.getByRole('button', { name: 'Open Orbit Breaker', exact: true });
    await page.locator('.game-card').filter({ has: orbit }).locator('.save-game').click();
    await orbit.click(); await page.frameLocator('#game-frame').locator('#board').waitFor();
    assert.equal(await sheet.evaluate(node => node.open), false);
    await page.locator('#close-dialog').click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    await activeParams({ view: 'starters', genre: 'arcade' });
    await open(false); await page.evaluate(() => history.forward());
    await page.waitForFunction(() => document.querySelector('#game-dialog').open && !document.querySelector('#mobile-filter-dialog').open);
    await page.frameLocator('#game-frame').locator('#board').waitFor();
    await page.locator('#close-dialog').click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites') || '[]').includes('orbit-breaker')));
    report.checks.push('Filtered cards save and launch the existing Orbit game; Back/Forward preserves the collection and closes the filter sheet before reopening a player');

    await page.setViewportSize({ width: 640, height: 360 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go({ view: 'starters', embed: '1' }); await open(true);
    await page.locator('#hide-unavailable').check();
    await targets(['#close-mobile-filters', '#reset-mobile-filters', '#apply-mobile-filters']);
    assert.equal(await sheet.evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.equal(await sheet.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    await page.locator('#apply-mobile-filters').tap(); await closedWithFocus();
    assert.equal(await page.locator('.tabs').evaluate(node => getComputedStyle(node).flexDirection), 'row');
    await noOverflow('Landscape Google Sites view');
    assert.deepEqual(errors, []);
    report.checks.push('The Google Sites/landscape sheet scrolls to usable 44px controls, honors reduced motion, and has no horizontal overflow or parent JavaScript errors');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally { fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); if (api) await api.dispose(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
