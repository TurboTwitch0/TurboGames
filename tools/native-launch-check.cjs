/* Native large-game transport checks. Bulk game parts are paused deliberately:
   these checks prove isolation, saves and navigation, not game completion. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/native-launch-check.json');
const nativeId = 'library-source/html5-games/clColorboxmustard.html';
function siteURL(parameters = {}) {
  const url = new URL(site); url.search = ''; url.hash = '';
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return url.href;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let api;
  let releaseParts;
  const partGate = new Promise(resolve => { releaseParts = resolve; });
  const report = { passed: false, site,
    method: 'Real existing Colorbox Mustard HTML in the integrated player. Its large project parts are paused to avoid downloading another132MB; this is not a gameplay test. Separate actual title-screen evidence is in large-launch-check.json.',
    checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
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
    let heldParts = 0;
    await context.route(/\/clColorboxmustard-assets\/project\.part\d+\.bin(?:[?#]|$)/, async route => {
      heldParts++;
      await partGate;
      await route.abort().catch(() => {});
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    const sourceRequests = [];
    const nativePath = new URL(nativeId, site).pathname;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', incoming => {
      if (new URL(incoming.url()).pathname === nativePath) sourceRequests.push({
        method: incoming.method(), type: incoming.resourceType(),
        owner: incoming.frame() === page.mainFrame() ? 'parent' : 'child'
      });
    });
    await page.goto(siteURL({ view: 'all', q: 'Colorbox Mustard' }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#result-count')?.textContent);
    const item = await page.evaluate(id => window.TURBO_CATALOG.find(item => item.id === id), nativeId);
    assert.equal(item?.directLaunch, true, 'Rebuild the catalog with its prepared native launch metadata before testing');
    assert.ok(item.sourceBytes > 2 * 1024 * 1024);
    await page.evaluate(id => localStorage.setItem('turbogames:save:' + id, JSON.stringify({ 'native-seed': 'seeded' })), nativeId);
    const baselineHistory = await page.evaluate(() => history.length);
    async function nativeFrame() {
      await page.waitForFunction(() => document.querySelector('#game-dialog')?.open
        && document.querySelector('#game-frame')?.dataset.nativeLaunch === '1');
      const frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
      await frame.waitForFunction(() => {
        try { return localStorage.getItem('native-seed') === 'seeded'; } catch { return false; }
      });
      await page.waitForFunction(() => document.querySelector('#player-loading').hidden);
      return frame;
    }
    async function closePlayer() {
      await page.locator('#close-dialog').click();
      await page.waitForFunction(() => !document.querySelector('#game-dialog').open
        && !new URL(location.href).searchParams.has('play'));
      await page.locator('#game-frame').waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: 'Open Colorbox Mustard', exact: true }).click();
    let frame = await nativeFrame();
    assert.equal(await page.locator('#game-frame').getAttribute('srcdoc'), null);
    assert.equal(await frame.evaluate(() => document.URL), new URL(item.source, site).href);
    assert.equal(await frame.evaluate(() => document.compatMode), 'CSS1Compat');
    assert.equal(await page.evaluate(() => history.length), baselineHistory + 1);
    assert.ok(sourceRequests.some(item => item.owner === 'parent' && item.method === 'HEAD'));
    assert.ok(sourceRequests.some(item => item.owner === 'child' && item.method === 'GET' && item.type === 'document'));
    assert.ok(!sourceRequests.some(item => item.owner === 'parent' && item.method === 'GET'));
    report.checks.push('The integrated player uses a parent HEAD and native child document GET, with no parent HTML GET or srcdoc copy; the real source URL and standards mode are retained');
    const oldNonce = await page.locator('#game-frame').evaluate(node => JSON.parse(node.getAttribute('name')).nonce);
    const storage = await frame.evaluate(async () => {
      let isolated = false; try { void parent.document; } catch { isolated = true; }
      localStorage.setItem('native-roundtrip', 'saved');
      sessionStorage.setItem('native-session', 'session');
      document.cookie = 'native_cookie=kept';
      return { isolated, seed: localStorage.getItem('native-seed'), bridgeInstalled: Boolean(window.__turboMemoryIndexedDB), nameCleared: window.name === '' };
    });
    assert.deepEqual(storage, { isolated: true, seed: 'seeded', bridgeInstalled: true, nameCleared: true });
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('turbogames:save:' + id) || '{}')['native-roundtrip'] === 'saved', nativeId);
    report.checks.push('The real compatibility bridge restores local saves, isolates the parent DOM, clears the config transport name, and installs the temporary IndexedDB fallback');
    await closePlayer();
    await page.goForward();
    frame = await nativeFrame();
    const restored = await frame.evaluate(() => ({ local: localStorage.getItem('native-roundtrip'), session: sessionStorage.getItem('native-session'), cookie: document.cookie }));
    assert.equal(restored.local, 'saved'); assert.equal(restored.session, 'session'); assert.match(restored.cookie, /native_cookie=kept/);
    assert.equal(await page.evaluate(() => history.length), baselineHistory + 1);
    report.checks.push('Close/Back and Forward reopen the real native title with local/session/cookie state preserved and only one added top-level history entry');
    await closePlayer();
    await page.locator('#search').fill('Orbit Breaker');
    await page.getByRole('button', { name: 'Open Orbit Breaker', exact: true }).click();
    await page.frameLocator('#game-frame').locator('#board').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#game-frame').getAttribute('name'), null);
    assert.equal(await page.locator('#game-frame').getAttribute('data-native-launch'), null);
    assert.ok(await page.locator('#game-frame').getAttribute('srcdoc'));
    frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    assert.equal(await frame.evaluate(() => localStorage.getItem('native-roundtrip')), null);
    await frame.evaluate(({ nonce, origin }) => parent.postMessage({ type: 'turbogames:storage', nonce, kind: 'local', data: { 'stale-native-message': 'bad' } }, origin), { nonce: oldNonce, origin: new URL(site).origin });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('turbogames:save:orbit-breaker') || '{}')['stale-native-message']), undefined);
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('turbogames:save:' + id) || '{}')['native-roundtrip'], nativeId), 'saved');
    report.checks.push('Switching to a normal Orbit Breaker launch clears native frame attributes, keeps game saves separate, and rejects a stale native nonce');
    await closePlayer();
    assert.ok(heldParts > 0, 'Bulk project requests must be paused, not downloaded');
    assert.deepEqual(errors, []);
    report.sourceRequests = sourceRequests;
    report.bulkRequestsPaused = heldParts;
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally {
    releaseParts();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    if (api) await api.dispose();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
