/* Real player feedback and starter navigation, with controlled network failures. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const output = process.env.TURBO_REPORT_PATH || 'reports/launch-feedback-check.json';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let api;
  const report = { passed: false, site, checks: [] };
  const releases = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        try {
          const incoming = route.request();
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(), ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response }); await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site, { waitUntil: 'domcontentloaded' });
    await page.locator('#hero-starters').click();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'starters');
    assert.equal(await page.locator('#starter-note').isVisible(), true);
    const names = await page.locator('.card-name').allTextContents();
    for (const name of ['Orbit Breaker', 'Little Match', '2048', 'Hextris', 'Block Blast', 'Bloons', 'Run']) assert.ok(names.includes(name));
    assert.deepEqual(names.slice(0, 3), ['2048', 'Hextris', 'Block Blast']);
    assert.equal(await page.evaluate(() => window.TURBO_CATALOG.length), 3099);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await page.locator('.card-name').allTextContents(), names);
    report.checks.push('Start here is a shareable collection of existing self-hosted picks; the complete 3,099-entry catalog remains available');

    await page.getByRole('button', { name: 'Open Orbit Breaker', exact: true }).click();
    await page.frameLocator('#game-frame').locator('#board').waitFor();
    const oldNonce = (await page.locator('#game-frame').getAttribute('srcdoc')).match(/"nonce":"([^"]+)"/)[1];
    await context.route('**/__turbo_missing_script__.js', route => route.fulfill({ status: 404, body: '' }));
    const frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    await frame.evaluate(() => { const script = document.createElement('script'); script.src = new URL('__turbo_missing_script__.js', document.baseURI).href; document.head.append(script); });
    await page.waitForFunction(() => document.querySelector('#player-status').textContent.includes('loading error'));
    assert.equal(await page.locator('#player-recovery').isVisible(), false, 'A reported script error must not cover a possibly working game');
    await page.locator('#reload-game').click();
    await page.frameLocator('#game-frame').locator('#board').waitFor();
    await page.waitForFunction(() => document.querySelector('#player-loading').hidden);
    assert.equal(await page.locator('#player-status').textContent(), '');
    const next = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    await next.evaluate(nonce => parent.postMessage({ type: 'turbogames:status', code: 'runtime-error', nonce, assetHost: 'stale.invalid' }, '*'), oldNonce);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#player-status').textContent(), '');
    report.checks.push('Real script failures produce a nonblocking warning; Restart clears it and stale nonce reports are rejected');

    const slow = await context.newPage();
    await slow.clock.install();
    await slow.route('**/games/orbit-breaker.html', async route => {
      await new Promise(resolve => releases.push(resolve));
      await route.abort().catch(() => {});
    });
    await slow.goto(new URL('?play=orbit-breaker', site).href, { waitUntil: 'domcontentloaded' });
    await slow.locator('#player-loading').waitFor();
    await slow.clock.runFor(12500);
    assert.equal(await slow.locator('#slow-loading').isVisible(), true);
    assert.equal(await slow.locator('#launch-progress').getAttribute('value'), null, 'Unknown download sizes must not show a fabricated percentage');
    assert.match(await slow.locator('#loading-new-tab').getAttribute('href'), /play=orbit-breaker/);
    await slow.locator('#cancel-loading').click();
    await slow.waitForFunction(() => !document.querySelector('#game-dialog').open);
    releases.splice(0).forEach(resolve => resolve());
    report.checks.push('A held download shows real slow-load choices after 12 seconds; cancel aborts and returns to browsing without invented progress');

    await slow.goto(new URL('?play=orbit-breaker', site).href, { waitUntil: 'domcontentloaded' });
    await slow.locator('#player-loading').waitFor();
    await slow.clock.runFor(60500);
    await slow.locator('#player-recovery').waitFor({ state: 'visible' });
    assert.match(await slow.locator('#recovery-description').textContent(), /took too long/);
    releases.splice(0).forEach(resolve => resolve());
    await slow.unroute('**/games/orbit-breaker.html');
    await slow.locator('#retry-game').click();
    await slow.frameLocator('#game-frame').locator('#board').waitFor();
    report.checks.push('A 60-second game-page timeout offers recovery and Retry launches the real original game');

    await page.goto(new URL('?view=all&q=Colorbox%20Mustard', site).href, { waitUntil: 'domcontentloaded' });
    await page.locator('.card-size').first().waitFor();
    assert.match(await page.locator('.card-size').first().getAttribute('title'), /before compression.*additional game assets/);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []);
    report.checks.push('Large game pages have an honest size hint, and the changed collection fits 390px and 320px layouts');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally { releases.splice(0).forEach(resolve => resolve()); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); if (api) await api.dispose(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
