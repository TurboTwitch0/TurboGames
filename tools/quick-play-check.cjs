/* Focused checks for the existing catalog's quick picks and return shelf. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/quick-play-check.json');
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      // Use the inherited trusted proxy and TLS validation for hosted checks.
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await page.context().route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
          const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
            ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
          await route.fulfill({ response });
          await response.dispose();
        } catch { await route.abort().catch(() => {}); }
      });
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const panel = page.locator('#quick-pick');
    const pick = page.locator('#pick-game');
    const shelf = page.locator('#recent-shelf');
    const go = async parameters => {
      await page.goto(siteURL(parameters), { waitUntil: 'domcontentloaded' });
      await page.locator('#result-count').waitFor({ state: 'visible' });
      await page.waitForFunction(() => Boolean(document.querySelector('#result-count').textContent));
    };
    const filterState = async expected => {
      const actual = await page.evaluate(() => ({ view: new URL(location.href).searchParams.get('view') || 'popular',
        q: document.querySelector('#search').value, sort: document.querySelector('#sort').value,
        available: document.querySelector('#hide-unavailable').checked }));
      assert.deepEqual(actual, expected);
    };
    const pickedItem = async () => {
      await panel.waitFor({ state: 'visible' });
      const id = await panel.getAttribute('data-pick-id');
      const item = await page.evaluate(id => window.TURBO_CATALOG.find(item => item.id === id), id);
      assert.ok(item, 'A quick pick must identify a real catalog entry');
      assert.notEqual(item.sourceStatus, 'unavailable', 'Known missing sources must not be quick picks');
      assert.equal((await page.locator('#pick-title').textContent()).trim(), item.title);
      assert.ok((await page.locator('#pick-category').textContent()).toLowerCase().includes(item.category));
      const cover = await page.locator('#pick-cover').evaluate(image => ({ src: image.src, loaded: image.complete && image.naturalWidth > 0 }));
      assert.equal(cover.src, new URL(item.image || 'assets/fallback-cover.svg', siteURL()).href);
      await page.locator('#pick-cover').evaluate(image => image.decode());
      assert.ok((await page.locator('#pick-context').textContent()).trim(), 'The pool needs useful context');
      return item;
    };
    const closed = async () => {
      await page.locator('#close-dialog').click();
      await page.waitForFunction(() => !document.querySelector('#game-dialog').open && !new URL(location.href).searchParams.has('play'));
    };
    const noOverflow = async label => {
      const size = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(size.document <= size.width && size.body <= size.width, label + ': ' + JSON.stringify(size));
    };
    await go();
    assert.equal(await shelf.isVisible(), false, 'A fresh browser must not show fabricated recents');
    assert.equal(await panel.isVisible(), false, 'Quick picks must wait for the visitor');
    assert.equal(await pick.isEnabled(), true);
    assert.equal(await page.locator('#clear-query').isVisible(), false);
    const missing = await page.evaluate(() => window.TURBO_CATALOG.find(item => item.sourceStatus === 'unavailable'));
    assert.ok(missing, 'The missing-source fixture must be an existing real catalog entry');
    report.checks.push('A fresh browser shows no fabricated Recent shelf or unsolicited quick pick');

    await go({ view: 'games', q: 'Orbit Breaker' });
    await pick.click();
    const orbit = await pickedItem();
    assert.equal(orbit.id, 'orbit-breaker', 'A single-result search must pick that result');
    assert.equal(await page.locator('#pick-save').getAttribute('aria-pressed'), 'false');
    await page.locator('#pick-save').click();
    assert.equal(await page.locator('#pick-save').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites')).includes('orbit-breaker')));
    await page.locator('#pick-play').click();
    await page.waitForFunction(() => document.querySelector('#game-dialog').open && new URL(location.href).searchParams.get('play') === 'orbit-breaker');
    await page.frameLocator('#game-frame').locator('#board').waitFor({ state: 'visible' });
    await closed();
    assert.equal(await shelf.isVisible(), false, 'The return shelf stays out of scoped browsing');
    await page.locator('.topbar .brand').click();
    await shelf.waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#recent-shelf-grid [data-recent-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recentId)), ['orbit-breaker']);
    await page.locator('#recent-shelf-grid [data-recent-id="orbit-breaker"]').click();
    await page.frameLocator('#game-frame').locator('#board').waitFor({ state: 'visible' });
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    await page.evaluate(() => history.forward());
    await page.frameLocator('#game-frame').locator('#board').waitFor({ state: 'visible' });
    await closed();
    report.checks.push('A scoped pick uses the matching real cover, saves to the existing library, launches Orbit, and returns through Recent with Back/Forward intact');

    await go({ view: 'saved' });
    assert.equal(await page.locator('.card-launch').count(), 1, 'The preceding save must be the only Saved entry');
    await pick.click();
    assert.equal((await pickedItem()).id, 'orbit-breaker');
    await page.locator('#pick-save').focus();
    await page.keyboard.press('Enter');
    assert.equal(await panel.isVisible(), false, 'Unsaving the sole Saved pick must close its stale preview');
    assert.equal(await pick.isDisabled(), true, 'An empty Saved library cannot supply a pick');
    assert.equal(await page.locator('.tab[data-category="saved"]').evaluate(node => node === document.activeElement), true,
      'Unsaving the sole pick must recover focus to the active Saved tab, not a hidden preview or disabled button');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:favorites'))), []);
    report.checks.push('Unsaving the only Saved pick closes its preview, updates storage, disables empty picking, and recovers keyboard focus to the Saved tab');

    const recentIds = ['little-match', 'orbit-breaker', 'library-source/html5-games/cl2048.html'];
    await page.evaluate(({ recentIds, missingId }) => {
      localStorage.setItem('turbogames:recent', JSON.stringify([...recentIds, missingId]));
      localStorage.setItem('turbogames:favorites', JSON.stringify(['little-match', 'orbit-breaker', missingId]));
    }, { recentIds, missingId: missing.id });
    await go();
    await shelf.waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#recent-shelf-grid [data-recent-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recentId)), recentIds);
    assert.equal(await page.locator('#recent-shelf-grid img').count(), 3);
    await page.locator('#see-recent').click();
    await filterState({ view: 'recent', q: '', sort: 'recommended', available: false });
    assert.equal(await shelf.isVisible(), false);
    await go({ view: 'saved' });
    assert.equal(await shelf.isVisible(), false);
    let previousId;
    for (let index = 0; index < 5; index++) {
      await page.locator(index ? '#pick-again' : '#pick-game').click();
      const item = await pickedItem();
      assert.ok(['orbit-breaker', 'little-match'].includes(item.id), 'A scoped Saved pick must belong to the eligible shortlist');
      if (previousId) assert.notEqual(item.id, previousId, 'Pick again must choose another match when possible');
      previousId = item.id;
    }
    await page.locator('#dismiss-pick').click();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await pick.evaluate(node => node === document.activeElement), true, 'Dismiss should return keyboard focus');
    await page.evaluate(missingId => localStorage.setItem('turbogames:favorites', JSON.stringify([missingId])), missing.id);
    await go({ view: 'saved' });
    assert.equal(await pick.isDisabled(), true, 'A pool containing only known missing sources cannot supply a pick');
    assert.equal(await panel.isVisible(), false);
    await go({ view: 'all', q: 'turbo-no-match-fixture-934871' });
    assert.equal(await pick.isDisabled(), true, 'No results must disable Pick for me');
    report.checks.push('Recent shows at most three real entries in recency order; Saved picks exclude known missing sources and avoid repeats; dismiss restores focus; empty pools disable picking');

    for (const trigger of ['search', 'category', 'sort', 'availability']) {
      await go({ view: 'games', q: 'Orbit Breaker' });
      await pick.click();
      await panel.waitFor({ state: 'visible' });
      if (trigger === 'search') {
        await page.locator('#search').fill('Little Match');
        await page.waitForFunction(() => new URL(location.href).searchParams.get('q') === 'Little Match');
      } else if (trigger === 'category') await page.locator('.tab[data-category="all"]').click();
      else if (trigger === 'sort') await page.locator('#sort').selectOption('title-asc');
      else await page.locator('#hide-unavailable').check();
      assert.equal(await panel.isVisible(), false, trigger + ' changes must discard stale quick picks');
    }
    report.checks.push('Changing the search, category, sorting, or source filter invalidates the old pick');

    await go({ view: 'games', q: 'Orbit Breaker', sort: 'title-desc', available: '1' });
    for (const filter of ['q', 'sort', 'available']) assert.equal(await page.locator('#active-filters [data-filter="' + filter + '"]').count(), 1);
    await page.locator('#active-filters [data-filter="q"]').click();
    await filterState({ view: 'games', q: '', sort: 'title-desc', available: true });
    await page.locator('#active-filters [data-filter="sort"]').click();
    await filterState({ view: 'games', q: '', sort: 'recommended', available: true });
    await page.locator('#active-filters [data-filter="available"]').click();
    await filterState({ view: 'games', q: '', sort: 'recommended', available: false });
    await go({ view: 'flash', q: 'Orbit Breaker', sort: 'title-desc', available: '1' });
    await page.locator('#search-all-results').waitFor({ state: 'visible' });
    await page.locator('#search-all-results').click();
    await filterState({ view: 'all', q: 'Orbit Breaker', sort: 'title-desc', available: true });
    assert.equal(await page.locator('#search-all-results').isVisible(), false);
    await go({ view: 'games', q: 'Orbit Breaker', sort: 'title-desc', available: '1' });
    await page.locator('#clear-query').click();
    await filterState({ view: 'games', q: '', sort: 'title-desc', available: true });
    assert.equal(await page.locator('#search').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#clear-query').isVisible(), false);
    await page.locator('#reset-filters').click();
    await filterState({ view: 'all', q: '', sort: 'recommended', available: false });
    report.checks.push('Individual filter chips preserve other filters; Search all broadens the scope; clearing query preserves scope and restores search focus; Reset clears all filters');

    await go({ view: 'all', sort: 'title-asc', available: '1' });
    const quickSearches = await page.locator('#quick-searches [data-query]').evaluateAll(nodes => nodes.map(node => node.dataset.query));
    assert.ok(quickSearches.length >= 3, 'Quick search shortcuts must offer a useful choice');
    for (const query of quickSearches) {
      await go({ view: 'all', sort: 'title-asc', available: '1' });
      await page.locator('#quick-searches [data-query="' + query + '"]').click();
      await filterState({ view: 'all', q: query, sort: 'title-asc', available: true });
      assert.ok(await page.locator('.card-launch').count(), 'The ' + query + ' shortcut must find actual titles');
      assert.equal(await page.locator('#quick-searches').isVisible(), false, 'Shortcuts should yield to the selected query');
    }
    report.checks.push('Quick-search shortcuts find real titles across the collection while preserving sorting and source filters');

    await go({ view: 'games', q: 'Orbit Breaker' });
    await pick.focus();
    await page.keyboard.press('Enter');
    await pickedItem();
    await page.locator('#dismiss-pick').focus();
    const focus = await page.locator('#dismiss-pick').evaluate(node => {
      const style = getComputedStyle(node);
      return { visible: node.matches(':focus-visible'), outline: parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    assert.ok(focus.visible && focus.outline > 0 && focus.style !== 'none', 'Dismiss must show keyboard focus');
    await page.keyboard.press('Enter');
    assert.equal(await panel.isVisible(), false);
    assert.equal(await pick.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    await pickedItem();
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false, 'Escape from the preview must dismiss it');
    assert.equal(await pick.evaluate(node => node === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pick.click();
    const animated = await page.locator('#quick-pick, #quick-pick *, #recent-shelf, #recent-shelf *').evaluateAll(nodes => nodes.filter(node => {
      const style = getComputedStyle(node);
      return style.animationName !== 'none' && parseFloat(style.animationDuration) > 0 || style.transitionDuration.split(',').some(value => parseFloat(value) > 0);
    }).map(node => node.id || node.className));
    assert.deepEqual(animated, [], 'Quick-pick and Recent controls must honor reduced motion');
    report.checks.push('Keyboard can open and dismiss a pick with visible focus and restored position; new controls honor reduced motion');

    const sibling = await page.context().newPage();
    sibling.on('pageerror', error => errors.push(error.message));
    try {
      await sibling.goto(siteURL(), { waitUntil: 'domcontentloaded' });
      await sibling.locator('#result-count').waitFor({ state: 'visible' });
      await sibling.evaluate(() => {
        localStorage.removeItem('turbogames:recent');
        localStorage.removeItem('turbogames:favorites');
      });
      await go();
      assert.equal(await shelf.isVisible(), false);
      await sibling.goto(siteURL({ play: 'orbit-breaker' }), { waitUntil: 'domcontentloaded' });
      await sibling.frameLocator('#game-frame').locator('#board').waitFor({ state: 'visible' });
      await page.locator('#recent-shelf-grid [data-recent-id="orbit-breaker"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#recent-count').textContent(), '1');
      await sibling.locator('#close-dialog').click();
      await sibling.waitForFunction(() => !document.querySelector('#game-dialog').open);
      await go({ view: 'games', q: 'Orbit Breaker' });
      await pick.click();
      assert.equal((await pickedItem()).id, 'orbit-breaker');
      assert.equal(await page.locator('#pick-save').getAttribute('aria-pressed'), 'false');
      await sibling.locator('#hero-save').click();
      await page.waitForFunction(() => document.querySelector('#pick-save').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#saved-count').textContent(), '1');
      await sibling.locator('#hero-save').click();
      await page.waitForFunction(() => document.querySelector('#pick-save').getAttribute('aria-pressed') === 'false');
      assert.equal(await panel.isVisible(), true, 'An external favorite update must not dismiss a Games-scoped pick');
      await page.locator('.topbar .brand').click();
      await shelf.waitFor({ state: 'visible' });
      await sibling.evaluate(() => localStorage.removeItem('turbogames:recent'));
      await shelf.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#recent-count').textContent(), '0');
    } finally { await sibling.close(); }
    await page.evaluate(ids => localStorage.setItem('turbogames:recent', JSON.stringify(ids)), recentIds);
    report.checks.push('Two real tabs synchronize the return shelf after a game launch and external recent clearing; quick-pick Save state follows other-tab favorite changes without a reload');

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await go();
      await noOverflow(width + 'px homepage with Recent');
      await shelf.scrollIntoViewIfNeeded();
      await go({ view: 'games', q: 'Orbit Breaker', sort: 'title-desc', available: '1' });
      await pick.click();
      await panel.scrollIntoViewIfNeeded();
      await noOverflow(width + 'px filters and quick pick');
      const targets = await page.locator('#pick-game, #pick-play, #pick-save, #pick-again, #dismiss-pick, #clear-query, #active-filters button, #reset-filters').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
        const rect = node.getBoundingClientRect();
        return { id: node.id || node.dataset.filter, width: rect.width, height: rect.height, x: rect.x };
      }));
      for (const target of targets) {
        assert.ok(target.width >= 44 && target.height >= 44, width + 'px target needs 44px: ' + JSON.stringify(target));
        assert.ok(target.x >= 0 && target.x + target.width <= width + 1, width + 'px target stays in view: ' + JSON.stringify(target));
      }
      const screenshot = '/tmp/turbogames-quick-play-' + width + '.png';
      await page.screenshot({ path: screenshot });
      report.screenshots.push(screenshot);
    }
    await go({ embed: '1', view: 'games', q: 'Orbit Breaker' });
    assert.equal(await shelf.isVisible(), false, 'Google Sites embeds must not show the return shelf');
    await pick.tap();
    assert.equal((await pickedItem()).id, 'orbit-breaker');
    await page.locator('#dismiss-pick').tap();
    assert.equal(await panel.isVisible(), false);
    await noOverflow('320px Google Sites quick pick');
    assert.deepEqual(errors, [], 'Quick discovery must not throw browser errors');
    report.checks.push('Homepage, active filters, and quick picks fit 1440px, 390px, and 320px; controls are 44px; Google Sites retains scoped picking without Recent shelf');
    report.passed = true;
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
