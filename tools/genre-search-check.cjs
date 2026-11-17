/* Genre-aware search and shortcut checks against the real catalog and UI. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/genre-search-check.json');
function urlFor(parameters = {}) {
  const url = new URL(site); url.search = ''; url.hash = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const report = { passed: false, site, method: 'Actual browser discovery, filtering, and a small original-game history flow. This is not a complete catalog gameplay test.', checks: [], genreQueries: {} };
  let api;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
      await context.route(/^https?:\/\//, async route => {
        const incoming = route.request();
        try {
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
    const go = async parameters => {
      await page.goto(urlFor(parameters), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(document.querySelector('#result-count')?.textContent));
    };
    const renderedIds = () => page.locator('#game-grid [data-save-id]').evaluateAll(nodes => nodes.map(node => node.dataset.saveId));
    const resultCount = async () => Number((await page.locator('#result-count').textContent()).match(/[\d,]+/)[0].replaceAll(',', ''));
    const expected = (parameters = {}) => page.evaluate(parameters => {
      const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const names = new Map(window.TurboGameCategories.categories.map(genre => [genre.id, genre.label]));
      const terms = normalize(parameters.q || '').split(/\s+/).filter(Boolean);
      const saved = new Set(JSON.parse(localStorage.getItem('turbogames:favorites') || '[]'));
      const recent = JSON.parse(localStorage.getItem('turbogames:recent') || '[]');
      return window.TURBO_CATALOG.filter(item => {
        const genres = item.genreHints || window.TurboGameCategories.genresFor(item);
        const scope = !parameters.view || parameters.view === 'all' || (parameters.view === 'saved' ? saved.has(item.id) : parameters.view === 'recent' ? recent.includes(item.id) : item.category === parameters.view);
        if (!scope || parameters.available === '1' && item.sourceStatus === 'unavailable' || parameters.genre && !genres.includes(parameters.genre)) return false;
        const text = normalize([item.title, item.category, ...(item.tags || []), ...genres.flatMap(id => [id, names.get(id) || ''])].join(' '));
        const query = normalize(parameters.q || '');
        return !query || terms.every(term => text.includes(term)) || text.replaceAll(' ', '').includes(query.replaceAll(' ', ''));
      }).map(item => item.id);
    }, parameters);
    const checkResults = async parameters => {
      const ids = await expected(parameters);
      assert.equal(await resultCount(), ids.length);
      const actual = await renderedIds();
      assert.equal(actual.length, Math.min(ids.length, 96));
      assert.ok(actual.every(id => ids.includes(id)));
      return ids;
    };

    for (const query of ['puzzle', 'racing', 'arcade', 'strategy', 'RPG']) {
      const parameters = { view: 'all', q: query };
      await go(parameters);
      const ids = await checkResults(parameters);
      report.genreQueries[query] = ids.length;
      if (query === 'puzzle') {
        for (const id of ['library-source/html5-games/cl2048.html', 'library-source/html5-games/clblockblast.html']) assert.ok(ids.includes(id), 'Genre search must find ' + id);
        assert.ok(ids.length >= 65, 'Puzzle must include the actual classified games, not only seven literal title/tag matches');
      }
    }
    report.checks.push('Genre IDs and human-readable labels find the actual matching catalog, including 2048 and Block Blast for puzzle and RPG/strategy aliases');

    await go({ view: 'all', q: 'puzzle flash' });
    const flash = await checkResults({ view: 'all', q: 'puzzle flash' });
    assert.ok(flash.includes('library-source/flash/clbloons.html'));
    await go({ view: 'all', genre: 'puzzle', q: 'orbit breaker' });
    await checkResults({ view: 'all', genre: 'puzzle', q: 'orbit breaker' });
    assert.equal(await resultCount(), 0, 'Text queries must still intersect a selected genre');
    await go({ view: 'apps', q: 'puzzle' });
    await checkResults({ view: 'apps', q: 'puzzle' });
    const invented = await page.evaluate(() => window.TURBO_CATALOG.filter(item => ['apps', 'misc'].includes(item.category) && (item.genreHints || []).length));
    assert.deepEqual(invented, [], 'Utilities and miscellaneous entries must not gain invented game genres');
    report.checks.push('Multiword queries intersect genre and source terms; selected genres stay scoped and apps/misc receive no fabricated genre matches');

    await go({ view: 'all' });
    const racer = await page.evaluate(() => window.TURBO_CATALOG.find(item => (item.genreHints || []).includes('racing') && !item.title.toLowerCase().includes('racing') && item.sourceStatus !== 'unavailable'));
    assert.ok(racer);
    await page.evaluate(id => {
      localStorage.setItem('turbogames:favorites', JSON.stringify([id, 'orbit-breaker']));
      localStorage.setItem('turbogames:recent', JSON.stringify([id, 'orbit-breaker']));
    }, racer.id);
    for (const view of ['saved', 'recent']) {
      await go({ view, q: 'racing' });
      await checkResults({ view, q: 'racing' });
      assert.deepEqual(await renderedIds(), [racer.id]);
    }
    report.checks.push('Saved and Recent searches stay inside their browser-local library while finding a racing title whose name does not contain racing');

    for (const shortcut of ['arcade', 'racing', 'puzzle', 'mario']) {
      await go({ view: 'all', sort: 'title-desc', available: '1' });
      const button = page.locator('#quick-searches [data-query="' + shortcut + '"]');
      await button.focus(); await page.keyboard.press('Enter');
      const isGenre = shortcut !== 'mario';
      const params = new URL(page.url()).searchParams;
      assert.equal(params.get('view'), 'all');
      assert.equal(params.get('q'), isGenre ? null : shortcut);
      assert.equal(params.get('genre'), isGenre ? shortcut : null);
      assert.equal(params.get('sort'), 'title-desc');
      assert.equal(params.get('available'), '1');
      assert.equal(await page.locator('#search').inputValue(), isGenre ? '' : shortcut);
      const expectedParameters = { view: 'all', sort: 'title-desc', available: '1', ...(isGenre ? { genre: shortcut } : { q: shortcut }) };
      await checkResults(expectedParameters);
      const previous = await renderedIds();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(document.querySelector('#result-count')?.textContent));
      assert.deepEqual(await renderedIds(), previous, 'Shortcut filter state must survive a bookmark/reload');
    }
    report.checks.push('Keyboard-activated Arcade/Racing/Puzzle shortcuts select real genres; Mario remains a text search, preserving sort/availability and reloadable URLs');

    await go({ view: 'all', q: 'ORBIT... BREAKER!' });
    assert.deepEqual(await renderedIds(), ['orbit-breaker']);
    await go({ view: 'all', q: 'qxz-unfindable-turbo-00991' });
    assert.equal(await resultCount(), 0);
    assert.equal(await page.locator('#empty-state').isVisible(), true);
    await go({ view: 'all', genre: 'arcade', q: 'Orbit Breaker' });
    await page.getByRole('button', { name: 'Open Orbit Breaker', exact: true }).click();
    await page.frameLocator('#game-frame').locator('#board').waitFor();
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    assert.equal(new URL(page.url()).searchParams.get('genre'), 'arcade');
    assert.equal(await page.locator('#search').inputValue(), 'Orbit Breaker');
    await page.goForward();
    await page.frameLocator('#game-frame').locator('#board').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('genre'), 'arcade');
    await page.locator('#close-dialog').click();
    await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
    assert.deepEqual(await renderedIds(), ['orbit-breaker']);
    assert.equal(await page.evaluate(() => window.TURBO_CATALOG.length), 3099);
    assert.deepEqual(errors, []);
    report.checks.push('Punctuation and empty results remain honest; the original game launches and Back/Forward preserve genre, query, and the complete 3,099-entry inventory');
    try { report.before = JSON.parse(fs.readFileSync('/tmp/turbo-genre-search-before.json', 'utf8')); } catch {}
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); if (api) await api.dispose(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
