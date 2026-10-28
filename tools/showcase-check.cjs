/* Focused checks for the existing arcade's selectable featured stage. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/showcase-check.json');

function siteURL(parameters = {}) {
  const url = new URL(site);
  url.search = '';
  url.hash = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const report = { passed: false, site, checks: [], screenshots: [] };
  let api;
  let releaseSource;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    page.setDefaultTimeout(15000);
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      // Retain the same trusted proxy and certificate validation as the other
      // production browser checks; Chromium itself cannot use the session proxy.
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await page.context().route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
          const response = await api.fetch(incoming.url(), {
            method: incoming.method(), headers: incoming.headers(),
            ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}),
            failOnStatusCode: false
          });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const stage = page.locator('#featured-stage');
    const dots = page.locator('#featured-dots button');
    const home = async parameters => {
      await page.goto(siteURL(parameters), { waitUntil: 'domcontentloaded' });
      await page.locator('.card-launch').first().waitFor({ state: 'visible' });
      if (!parameters?.embed) await stage.waitFor({ state: 'visible' });
    };
    const noOverflow = async label => {
      const sizes = await page.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth
      }));
      assert.ok(sizes.document <= sizes.viewport && sizes.body <= sizes.viewport,
        label + ' must fit the viewport: ' + JSON.stringify(sizes));
    };
    const focusByTab = async selector => {
      for (let attempt = 0; attempt < 32; attempt++) {
        if (await page.locator(selector).evaluate(node => node === document.activeElement)) return;
        await page.keyboard.press('Tab');
      }
      assert.fail(selector + ' must be reachable using Tab');
    };
    const focusRing = async selector => {
      const focus = await page.locator(selector).evaluate(node => {
        const style = getComputedStyle(node);
        const shadow = style.boxShadow;
        const outline = parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== 'none'
          && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.outlineColor);
        const active = node === document.activeElement;
        const visible = node.matches(':focus-visible');
        node.blur();
        const unfocusedShadow = getComputedStyle(node).boxShadow;
        node.focus({ preventScroll: true });
        return {
          active, visible, indicator: outline || shadow !== 'none' && shadow !== unfocusedShadow
        };
      });
      assert.ok(focus.active && focus.visible && focus.indicator,
        selector + ' needs a visible keyboard focus indicator: ' + JSON.stringify(focus));
    };
    await home();
    assert.equal(await stage.getAttribute('role'), 'region');
    assert.equal(await stage.getAttribute('aria-label'), 'Featured games');
    assert.equal(await stage.getAttribute('tabindex'), '0');
    assert.equal(await dots.count(), 3, 'The stage must offer three direct choices');
    const titles = await dots.evaluateAll(nodes => nodes.map(node => {
      const label = node.getAttribute('aria-label') || '';
      return label.startsWith('Show ') ? label.slice(5) : '';
    }));
    assert.ok(titles.every(Boolean) && new Set(titles).size === 3, 'Each choice must name its game');
    const items = await page.evaluate(titles => titles.map(title => {
      const item = window.TURBO_CATALOG.find(item => item.title === title);
      return item && { id: item.id, title: item.title, category: item.category, source: item.source, sourceStatus: item.sourceStatus };
    }), titles);
    assert.ok(items.every(item => item?.source && item.sourceStatus !== 'unavailable'),
      'Each featured title must be a real available catalog game');
    assert.equal(items[0].id, 'orbit-breaker', 'The stage must initially feature Orbit Breaker');
    report.featured = items.map(({ id, title }) => ({ id, title }));
    const selected = async index => {
      await page.waitForFunction(title => document.querySelector('#featured-title')?.textContent.trim() === title, titles[index]);
      assert.equal(await dots.nth(index).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#featured-dots button[aria-pressed="true"]').count(), 1);
      assert.match((await page.locator('#featured-status').textContent()).replace(/\s+/g, ' '),
        new RegExp('\\b' + (index + 1) + ' of ' + items.length + '\\b'));
      assert.equal(await page.locator('.featured-card[data-position="current"]').count(), 1);
      const currentName = await page.locator('.featured-card[data-position="current"]').evaluate(node =>
        [node.getAttribute('aria-label'), node.textContent, ...[...node.querySelectorAll('img')].map(image => image.alt)].join(' '));
      assert.ok(currentName.includes(items[index].title), 'The current card must represent ' + items[index].title);
      assert.match(await page.locator('#hero-play').textContent(), new RegExp(items[index].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(await page.locator('#hero-save').getAttribute('data-save-id'), items[index].id);
    };
    await selected(0);
    assert.ok(['polite', 'assertive'].includes(await page.locator('#featured-status').getAttribute('aria-live'))
      || await page.locator('#featured-status').getAttribute('role') === 'status', 'Selection changes need a live status');
    for (const position of ['previous', 'next']) {
      const card = page.locator('.featured-card[data-position="' + position + '"]');
      assert.equal(await card.count(), 1);
      assert.equal(await card.evaluate(node => node.tagName), 'BUTTON', 'Side cards must be actual buttons');
    }
    report.checks.push('Three named catalog games have one selected card, direct choices, and a live position status');

    await page.locator('#search').focus();
    await focusByTab('#featured-stage');
    await focusRing('#featured-stage');
    for (const [key, expected] of [['ArrowLeft', 2], ['ArrowRight', 0], ['End', 2], ['Home', 0]]) {
      await page.keyboard.press(key);
      await selected(expected);
    }
    for (const selector of ['#featured-prev', '#featured-next']) {
      await focusByTab(selector);
      await focusRing(selector);
    }
    await page.locator('#featured-prev').click();
    await selected(2);
    await page.locator('#featured-next').click();
    await selected(0);
    for (const selector of ['#search', '#hero-play']) {
      await page.locator(selector).focus();
      for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        await page.keyboard.press(key);
        await selected(0);
      }
    }
    for (let index = 0; index < items.length; index++) {
      await dots.nth(index).click();
      await selected(index);
    }
    for (const position of ['previous', 'next']) {
      const card = page.locator('.featured-card[data-position="' + position + '"]');
      const name = await card.evaluate(node => [node.getAttribute('aria-label'), node.textContent,
        ...[...node.querySelectorAll('img')].map(image => image.alt)].join(' '));
      const expected = titles.findIndex(title => name.includes(title));
      assert.ok(expected >= 0, 'A side card must name the game it selects');
      await card.click();
      await selected(expected);
    }
    await dots.nth(1).focus();
    await page.keyboard.press('Tab');
    await dots.nth(1).focus();
    await focusRing('#featured-dots button:nth-child(2)');
    await page.locator('#search').focus();
    await page.mouse.move(2, 2);
    const stillTitle = await page.locator('#featured-title').textContent();
    await page.waitForTimeout(6000);
    assert.equal(await page.locator('#featured-title').textContent(), stillTitle, 'The stage must not autoplay');
    report.checks.push('Stage keyboard navigation, arrows, side cards, and named choices select games; other focused controls keep their keys; selection does not autoplay');

    for (let index = 0; index < items.length; index++) {
      await dots.nth(index).click();
      await selected(index);
      // Hold only the chosen game's original source. This checks the real source
      // dispatch without starting three unrelated game runtimes or asset scans.
      const sourceURL = new URL(items[index].source.split('/').map(encodeURIComponent).join('/'), siteURL()).href;
      const requested = page.waitForRequest(sourceURL);
      const released = new Promise(resolve => { releaseSource = resolve; });
      const holdSource = async route => { await released; await route.fallback().catch(() => {}); };
      await page.route(sourceURL, holdSource);
      await page.locator('#hero-play').click();
      await requested;
      await page.waitForFunction(() => document.querySelector('#game-dialog').open);
      assert.equal((await page.locator('#dialog-title').textContent()).trim(), items[index].title);
      assert.equal(new URL(page.url()).searchParams.get('play'), items[index].id);
      await page.locator('#close-dialog').click();
      await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !new URL(location.href).searchParams.has('play'));
      releaseSource();
      releaseSource = undefined;
      await page.unroute(sourceURL, holdSource);
      await page.locator('#hero-save').click();
      assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites'))), items.slice(0, index + 1).map(item => item.id));
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await stage.waitFor({ state: 'visible' });
    await selected(0);
    assert.equal(await page.locator('#hero-save').getAttribute('aria-pressed'), 'true');
    await page.locator('#hero-saved').click();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'saved');
    for (const item of items) {
      const card = page.locator('.game-card').filter({ has: page.getByRole('button', { name: 'Open ' + item.title, exact: true }) });
      await card.waitFor({ state: 'visible' });
      assert.equal(await card.locator('.save-game').getAttribute('aria-pressed'), 'true');
      await card.locator('.save-game').click();
    }
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#saved-count').textContent(), '0');
    report.checks.push('Each selected Play opens its matching route and requests its actual source; each selected Save persists and appears in the real Saved library');

    for (let index = 0; index < items.length; index++) {
      await home();
      await dots.nth(index).click();
      await page.locator('#featured-browse').click();
      assert.equal(new URL(page.url()).searchParams.get('view'), items[index].category);
      assert.equal(await page.locator('.tab[data-category="' + items[index].category + '"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await stage.isVisible(), false);
      await page.locator('#search').fill(items[index].title);
      await page.getByRole('button', { name: 'Open ' + items[index].title, exact: true }).waitFor({ state: 'visible' });
    }
    report.checks.push('Browse opens each selected game’s real category, where the matching catalog title is discoverable');

    const touch = await page.context().newCDPSession(page);
    const swipe = async (x, y, dx, dy) => {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6 }] });
        await page.waitForTimeout(20);
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await home();
    await stage.scrollIntoViewIfNeeded();
    let bounds = await page.locator('.featured-card[data-position="current"]').boundingBox();
    assert.ok(bounds);
    await swipe(bounds.x + bounds.width * .75, bounds.y + bounds.height * .4, -Math.min(130, bounds.width * .5), 3);
    await selected(1);
    await page.waitForFunction(() => [...document.querySelectorAll('.featured-card')]
      .every(node => node.getAnimations().every(animation => animation.playState !== 'running')));
    bounds = await page.locator('.featured-card[data-position="current"]').boundingBox();
    await swipe(bounds.x + bounds.width * .25, bounds.y + bounds.height * .4, Math.min(130, bounds.width * .5), 3);
    await selected(0);
    await page.locator('.welcome-copy').scrollIntoViewIfNeeded();
    const copy = await page.locator('.welcome-copy').boundingBox();
    await swipe(copy.x + copy.width * .75, Math.max(140, copy.y + 30), -100, 2);
    await selected(0);
    await stage.scrollIntoViewIfNeeded();
    bounds = await page.locator('.featured-card[data-position="current"]').boundingBox();
    const beforeScroll = await page.evaluate(() => scrollY);
    await swipe(bounds.x + bounds.width * .5, Math.min(740, bounds.y + bounds.height * .65), 4, -130);
    await page.waitForFunction(before => scrollY > before + 20, beforeScroll);
    await selected(0);
    await touch.detach();
    report.checks.push('Touch swipes inside the stage select one adjacent game; outside gestures do not select; vertical gestures retain native page scrolling');

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await home();
      await noOverflow(width + 'px home');
      await stage.scrollIntoViewIfNeeded();
      const targets = await page.locator('#featured-prev, #featured-next, #featured-dots button, #hero-play, #hero-save, #featured-browse').evaluateAll(nodes => nodes.map(node => {
        const bounds = node.getBoundingClientRect();
        return { id: node.id || node.getAttribute('aria-label'), x: bounds.x, width: bounds.width, height: bounds.height };
      }));
      for (const target of targets) {
        assert.ok(target.width >= 44 && target.height >= 44, width + 'px touch target: ' + JSON.stringify(target));
        assert.ok(target.x >= 0 && target.x + target.width <= width + 1, width + 'px control must stay in view: ' + JSON.stringify(target));
      }
      const screenshot = '/tmp/turbogames-showcase-' + width + '.png';
      await page.screenshot({ path: screenshot, fullPage: false });
      report.screenshots.push(screenshot);
    }
    report.checks.push('Featured layout fits 1440px, 390px, and 320px without document overflow; stage controls remain in view and have 44px touch targets');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await page.locator('#featured-stage, #featured-stage *, .featured-card').evaluateAll(nodes => {
      const duration = value => Math.max(...value.split(',').map(time => parseFloat(time) * (time.trim().endsWith('ms') ? .001 : 1)));
      return nodes.flatMap(node => {
        const style = getComputedStyle(node);
        const animated = style.animationName !== 'none' && duration(style.animationDuration) > .001;
        const transition = duration(style.transitionDuration) > .001;
        const dimensional = style.transform.startsWith('matrix3d') || style.perspective !== 'none';
        return animated || transition || dimensional ? [{ element: node.id || node.className, animation: style.animationName,
          transition: style.transitionDuration, transform: style.transform, perspective: style.perspective }] : [];
      });
    });
    assert.deepEqual(motion, [], 'Reduced motion needs an immediate static 2D stage fallback');
    await dots.nth(2).click();
    await selected(2);
    await home({ embed: '1' });
    assert.equal(await stage.isVisible(), false, 'Existing embeds must hide the featured stage');
    assert.deepEqual(errors, [], 'The focused featured flows must not throw browser errors');
    report.checks.push('Reduced motion removes stage transitions, animations, and 3D effects while preserving selection; existing embeds hide the stage');
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) {
    report.error = error.stack || error.message;
    throw error;
  } finally {
    releaseSource?.();
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    await api?.dispose();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
