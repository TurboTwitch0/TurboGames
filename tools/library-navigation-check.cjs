/* Focused browser checks for the existing catalog's library navigation. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || 'reports/library-navigation-check.json';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let api;
  const report = { passed: false, site, checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, hasTouch: true });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        try {
          const incoming = route.request();
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(), ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const go = async query => {
      const url = new URL(site); url.search = query || ''; url.hash = '';
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#result-count')?.textContent);
    };
    await go('view=all&q=mario&sort=title-desc&available=1');
    for (const view of ['saved', 'recent']) {
      await page.locator('#header-' + view).click();
      const params = new URL(page.url()).searchParams;
      assert.equal(params.get('view'), view);
      assert.equal(params.get('q'), null);
      assert.equal(params.get('sort'), null);
      assert.equal(params.get('available'), null);
      assert.equal(await page.locator('#header-' + view).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.tab[data-category=' + view + ']').getAttribute('aria-pressed'), 'true');
    }
    report.checks.push('Persistent Saved and Recent shortcuts open real collections, reset stale filters, and synchronize active navigation');
    const peer = await context.newPage();
    await peer.goto(site, { waitUntil: 'domcontentloaded' });
    await peer.locator('#hero-save').click();
    await page.waitForFunction(() => document.querySelector('[data-library-count=saved]').textContent === '1');
    assert.equal(await page.locator('[data-library-count=saved]').isVisible(), true);
    await page.locator('#header-saved').click();
    assert.equal(await page.getByRole('button', { name: 'Open Orbit Breaker', exact: true }).count(), 1);
    await peer.locator('#hero-save').click();
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-library-count=saved]').isVisible(), false);
    await peer.close();
    report.checks.push('Header favorite counts follow real changes from another tab; empty counters stay hidden and Saved remains accurate');
    await go('view=all');
    const counts = await page.evaluate(() => [...document.querySelectorAll('[data-scope-count]')].map(node => {
      const key = node.dataset.scopeCount;
      return { key, count: Number(node.textContent.replaceAll(',', '')), expected: window.TURBO_CATALOG.filter(item => key === 'all' || (key === 'popular' ? item.featured : item.category === key)).length };
    }));
    assert.ok(counts.every(item => item.count === item.expected));
    assert.equal(await page.getByRole('button', { name: 'Games', exact: true }).count(), 1);
    assert.equal(await page.locator('.tabs').evaluate(node => getComputedStyle(node).position), 'sticky');
    report.checks.push('Sidebar counts match the unchanged catalog and keep category names accessible');
    await page.keyboard.press('/');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#header-saved').evaluate(node => node === document.activeElement && node.matches(':focus-visible')), true);
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).searchParams.get('view'), 'saved');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('#header-saved').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    report.checks.push('Library shortcuts work with keyboard focus and reduced motion');
    for (const width of [1440, 1024, 760, 520, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await go('view=all');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
      for (const id of ['header-saved', 'header-recent']) {
        const box = await page.locator('#' + id).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, id + ' fits at ' + width);
      }
      if (width <= 390) {
        await page.locator('#header-recent').tap();
        assert.equal(new URL(page.url()).searchParams.get('view'), 'recent');
      }
    }
    await go('embed=1&view=all');
    assert.equal(await page.locator('.tabs').evaluate(node => getComputedStyle(node).flexDirection), 'row');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    report.checks.push('Navigation fits 1440/1024/760/520/390/320px, has 44px targets and real touch activation, and keeps Google Sites compact');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); if (api) await api.dispose(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
