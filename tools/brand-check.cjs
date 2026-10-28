/* Focused checks for the branded home screen and its existing player/library flows. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/brand-check.json');

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
  const report = { passed: false, site, checks, screenshots: [] };
  let api;
  let releaseDownload;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      // Match discovery-check.cjs: retain the environment's trusted HTTP proxy
      // and certificate validation when checking a hosted preview.
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await page.context().route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
          const response = await api.fetch(incoming.url(), {
            method: incoming.method(),
            headers: incoming.headers(),
            ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}),
            failOnStatusCode: false
          });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const board = () => page.frameLocator('#game-frame').locator('#board');
    const orbitCard = () => page.locator('.game-card').filter({
      has: page.getByRole('button', { name: 'Open Orbit Breaker', exact: true })
    });
    const waitForDialog = open => page.waitForFunction(
      expected => document.querySelector('#game-dialog').open === expected, open
    );
    const home = async () => {
      await page.goto(siteURL(), { waitUntil: 'domcontentloaded' });
      await page.locator('#hero-play').waitFor({ state: 'visible' });
      await page.locator('.card-launch').first().waitFor({ state: 'visible' });
    };
    const closePlayer = async () => {
      await page.keyboard.press('Escape');
      await waitForDialog(false);
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('play'));
    };
    const assertNoOverflow = async label => {
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth
      }));
      assert.ok(dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport,
        label + ' must fit the viewport: ' + JSON.stringify(dimensions));
    };
    const focusByTab = async (selector, key = 'Tab') => {
      for (let attempt = 0; attempt < 28; attempt++) {
        if (await page.locator(selector).evaluate(node => node === document.activeElement)) return;
        await page.keyboard.press(key);
      }
      assert.fail(selector + ' must be reachable using Tab');
    };
    const assertFocusRing = async selector => {
      const focus = await page.locator(selector).evaluate(node => {
        const style = getComputedStyle(node);
        return {
          active: node === document.activeElement,
          visible: node.matches(':focus-visible'),
          outline: parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== 'none'
            && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.outlineColor),
          shadow: style.boxShadow !== 'none'
        };
      });
      assert.ok(focus.active && focus.visible && (focus.outline || focus.shadow),
        selector + ' needs a visible keyboard focus indicator: ' + JSON.stringify(focus));
    };
    const delayOrbitDownload = async () => {
      const requestStarted = page.waitForRequest('**/games/orbit-breaker.html');
      const released = new Promise(resolve => { releaseDownload = resolve; });
      const handler = async route => {
        await released;
        await route.fallback();
      };
      await page.route('**/games/orbit-breaker.html', handler);
      return {
        requestStarted,
        release: async () => {
          releaseDownload();
          releaseDownload = undefined;
          await page.unroute('**/games/orbit-breaker.html', handler);
        }
      };
    };

    await home();
    await assertNoOverflow('1440px home');
    const searchAppearance = await page.locator('.searchbox').evaluate(node => {
      const style = getComputedStyle(node);
      return [style.borderColor, style.boxShadow, style.outline].join('|');
    });
    await page.keyboard.press('/');
    assert.equal(await page.locator('#search').evaluate(node => node === document.activeElement), true);
    await page.waitForFunction(previous => {
      const label = getComputedStyle(document.querySelector('.searchbox'));
      const input = getComputedStyle(document.querySelector('#search'));
      return previous !== [label.borderColor, label.boxShadow, label.outline].join('|')
        || parseFloat(input.outlineWidth) > 0 && input.outlineStyle !== 'none'
        || input.boxShadow !== 'none';
    }, searchAppearance);
    assert.equal(await page.locator('#search').inputValue(), '');
    await focusByTab('#hero-play');
    await assertFocusRing('#hero-play');
    const delayed = await delayOrbitDownload();
    await page.keyboard.press('Enter');
    await delayed.requestStarted;
    await waitForDialog(true);
    assert.equal(await page.locator('#dialog-title').textContent(), 'Orbit Breaker');
    assert.equal(new URL(page.url()).searchParams.get('play'), 'orbit-breaker');
    await page.locator('#player-loading').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#player-recovery').isVisible(), false);
    await assertNoOverflow('1440px player');
    await delayed.release();
    await board().waitFor({ state: 'visible' });
    await page.locator('#player-loading').waitFor({ state: 'hidden' });
    await closePlayer();
    checks.push('Slash focuses search with visible feedback; Tab and Enter launch Orbit Breaker; Escape closes the player');
    checks.push('The loading treatment stays visible during a held local source request and hides when the game is ready');

    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'false');
    await focusByTab('#hero-save', 'Shift+Tab');
    await assertFocusRing('#hero-save');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#hero-save').getAttribute('aria-pressed') === 'true');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites'))), ['orbit-breaker']);
    assert.equal(await page.locator('#saved-count').textContent(), '1');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#hero-play').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'true');
    await page.locator('#hero-saved').click();
    await page.waitForFunction(() => document.querySelector('.tab[data-category="saved"]').getAttribute('aria-pressed') === 'true');
    assert.equal(new URL(page.url()).searchParams.get('view'), 'saved');
    assert.match(await page.locator('#catalog-title').textContent(), /saved/i);
    await orbitCard().waitFor({ state: 'visible' });
    assert.equal(await orbitCard().locator('.save-game').getAttribute('aria-pressed'), 'true');
    await orbitCard().locator('.save-game').click();
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#saved-count').textContent(), '0');
    await page.locator('.topbar a.brand').click();
    await page.locator('#hero-save').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'false');
    await page.locator('#hero-save').click();
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'true');
    await page.locator('#hero-save').click();
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites'))), []);
    await page.locator('#hero-saved').click();
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.card-launch').count(), 0);
    checks.push('Hero Save persists the real favorite; Saved opens the real collection; card and hero removal stay synchronized');

    await home();
    const failedDownload = route => route.abort('failed');
    await page.route('**/games/orbit-breaker.html', failedDownload);
    await page.locator('#hero-play').click();
    await page.locator('#player-recovery').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#player-loading').isVisible(), false);
    assert.equal(await page.locator('#retry-game').isVisible(), true);
    assert.ok((await page.locator('#recovery-description').textContent()).trim().length > 10);
    await page.unroute('**/games/orbit-breaker.html', failedDownload);
    const retryDownload = await delayOrbitDownload();
    await page.locator('#retry-game').click();
    await retryDownload.requestStarted;
    await page.locator('#player-loading').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#player-recovery').isVisible(), false);
    await retryDownload.release();
    await board().waitFor({ state: 'visible' });
    await page.locator('#player-loading').waitFor({ state: 'hidden' });
    await closePlayer();
    checks.push('A failed source replaces loading with useful recovery; Retry restores loading and opens the original game');

    await home();
    const imageProblems = await page.locator('img').evaluateAll(images => images.flatMap(image => {
      if (!image.hasAttribute('alt')) return [image.getAttribute('src') + ': missing alt'];
      if (image.alt.trim()) return [];
      // Empty alt supplies the decorative semantics itself. It is appropriate
      // for the repeated mark beside the wordmark and in the loading status.
      const conflictingSemantics = image.tabIndex >= 0 || image.getAttribute('role') === 'img'
        || image.hasAttribute('aria-label');
      return conflictingSemantics ? [image.getAttribute('src') + ': decorative alt conflicts with image semantics'] : [];
    }));
    assert.deepEqual(imageProblems, [], 'Home screen images need meaningful alt or decorative context');
    const logos = page.locator('.brand img[src$=".svg"], .brand img[src*=".svg?"]');
    assert.ok(await logos.count() > 0, 'The brand must use its SVG logo');
    await logos.first().evaluate(image => image.decode());
    assert.equal(await logos.first().evaluate(image => image.complete && image.naturalWidth > 0), true);
    const preview = page.locator('img[src*="assets/brand/orbit-preview.webp"]');
    assert.equal(await preview.count(), 1, 'The featured preview must use the original Orbit Breaker image');
    await preview.evaluate(image => image.decode());
    assert.equal(await preview.evaluate(image => image.complete && image.naturalWidth > 0), true);
    checks.push('Rendered images have alt text or decorative context; the SVG logo and original Orbit preview load');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await page.locator('.welcome *, .game-card, .card-art, .card-play, .tab, #player-loading, #player-loading *').evaluateAll(nodes => {
      const duration = value => Math.max(...value.split(',').map(time => parseFloat(time) * (time.trim().endsWith('ms') ? .001 : 1)));
      return nodes.flatMap(node => {
        const style = getComputedStyle(node);
        const animation = style.animationName !== 'none' && duration(style.animationDuration) > .001;
        const transition = duration(style.transitionDuration) > .001;
        return animation || transition ? [{ element: node.id || node.className, animation: style.animationName, transition: style.transitionDuration }] : [];
      });
    });
    assert.deepEqual(motion, [], 'Reduced motion must disable hero, card, loading, and navigation motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    checks.push('Reduced motion disables decorative animations and transitions');

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await home();
      await assertNoOverflow(width + 'px home');
      const screenshot = '/tmp/turbogames-brand-' + width + '.png';
      await page.screenshot({ path: screenshot, fullPage: false });
      report.screenshots.push(screenshot);
      await page.locator('#hero-play').click();
      await board().waitFor({ state: 'visible' });
      await page.locator('#player-loading').waitFor({ state: 'hidden' });
      await assertNoOverflow(width + 'px player');
      const closeBounds = await page.locator('#close-dialog').boundingBox();
      assert.ok(closeBounds && closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= width,
        'Close control must remain in the ' + width + 'px viewport');
      await closePlayer();
      await page.locator('#hero-saved').click();
      await page.locator('#empty-state').waitFor({ state: 'visible' });
      await assertNoOverflow(width + 'px Saved collection');
    }
    checks.push('Home, Saved, and player fit 1440px, 390px, and 320px viewports without document overflow');
    assert.deepEqual(pageErrors, [], 'The focused brand flows must not throw browser errors');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) {
    report.error = error.stack || error.message;
    throw error;
  } finally {
    releaseDownload?.();
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    await api?.dispose();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
