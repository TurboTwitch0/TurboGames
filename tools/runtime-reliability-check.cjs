/* Real isolated-player regression checks. Core classics must run with outside
   game hosts unavailable; Unity fixtures model the exact opaque-frame failures. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(__dirname, '../reports/runtime-reliability-check.json');
const origin = new URL(site).origin;
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const report = { passed: false, site, method: 'Actual browser startup and input checks; outside game/CDN hosts blocked for localized classics. No complete catalog playthrough claim.', checks: [], games: [] };
  let api;
  try {
    if (!['127.0.0.1', 'localhost'].includes(new URL(site).hostname)) {
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      api = await request.newContext({ ...(proxy ? { proxy: { server: proxy } } : {}), timeout: 25000 });
    }
    const context = await browser.newContext({ viewport: { width: 1180, height: 840 } });
    const blocked = [], failures = [], pageErrors = [], dialogs = [], unityBuildResponses = [];
    await context.route(/^https?:\/\//, async route => {
      const incoming = route.request(), url = new URL(incoming.url());
      if (url.origin !== origin) { blocked.push(url.hostname); return route.abort(); }
      if (!api) return route.continue();
      try {
        const response = await api.fetch(incoming.url(), { method: incoming.method(), headers: incoming.headers(),
          ...(incoming.postDataBuffer() ? { data: incoming.postDataBuffer() } : {}), failOnStatusCode: false });
        await route.fulfill({ response }); await response.dispose();
      } catch { await route.abort().catch(() => {}); }
    });
    const page = await context.newPage();
    page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === origin) failures.push({ url: response.url(), status: response.status() }); });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.includes('/vendor/games/block-blast/Build/')) unityBuildResponses.push({ file: url.pathname.split('/').pop(), status: response.status() });
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push(dialog.message().slice(0, 220)); await dialog.dismiss(); });
    const open = async id => {
      const url = new URL(site); url.search = ''; url.hash = ''; url.searchParams.set('play', id);
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.locator('#game-dialog').waitFor({ state: 'visible' });
      return page.frameLocator('#game-frame');
    };
    const loaderCode = `function createUnityInstance(canvas, options, progress) { window.fixtureUnityResult = { url: new URL(options.streamingAssetsUrl, document.URL).href, marker: options.marker, cacheType: typeof window.caches, args: arguments.length }; return Promise.resolve(window.fixtureUnityResult); }`;
    const loaderURL = 'data:application/javascript;base64,' + Buffer.from(loaderCode).toString('base64');
    const fixtureURL = new URL('library-source/html5-games/cl2048.html', site).href;
    await page.route(fixtureURL, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><base href="https://creator.example/games/demo/"><canvas></canvas>
      <script src="${loaderURL}"></script>
      <script>createUnityInstance(document.querySelector('canvas'), Object.freeze({ streamingAssetsUrl: 'StreamingAssets', marker: 17 }), function(){});</script>` }));
    let game = await open('library-source/html5-games/cl2048.html');
    await game.locator('canvas').waitFor();
    await page.waitForFunction(() => !document.querySelector('#player-loading') || document.querySelector('#player-loading').hidden);
    const fixtureFrame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    await fixtureFrame.waitForFunction(() => window.fixtureUnityResult);
    const fixture = await fixtureFrame.evaluate(() => window.fixtureUnityResult);
    assert.deepEqual(fixture, { url: 'https://creator.example/games/demo/StreamingAssets', marker: 17, cacheType: 'undefined', args: 3 });
    assert.deepEqual(pageErrors, []);
    report.checks.push('Unity loader declarations are wrapped before startup; relative StreamingAssets resolve against the true creator base, frozen options and callback arguments are preserved, and denied optional Cache API falls back to absence');
    await page.evaluate(() => {
      window.runtimeStatuses = [];
      window.addEventListener('message', event => {
        if (event.data?.type === 'turbogames:status' && event.data.code === 'runtime-error') window.runtimeStatuses.push(event.data);
      });
    });
    await fixtureFrame.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
      message: 'Private diagnostic ?token=never-forward-this', filename: 'https://assets.example/game.js?token=never-forward-this#private'
    })));
    await page.waitForFunction(() => window.runtimeStatuses.length === 1);
    const notices = await page.evaluate(() => window.runtimeStatuses);
    assert.equal(notices[0].assetHost, 'assets.example');
    assert.equal(notices[0].detail, 'The game reported a startup script error.');
    assert.ok(!JSON.stringify(notices).includes('never-forward-this'));
    await fixtureFrame.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
      message: 'Optional analytics failure', filename: 'https://www.google-analytics.com/analytics.js'
    })));
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.runtimeStatuses.length), 1);
    report.checks.push('Startup notices carry only a neutral detail and hostname; private query/stack/message contents stay inside the frame and known optional analytics errors are ignored');
    await page.unroute(fixtureURL);
    const classics = [
      ['library-source/html5-games/cl2048.html', '2048'],
      ['library-source/html5-games/clhextris.html', 'Hextris'],
      ['library-source/flash/clbloons.html', 'Bloons'],
      ['library-source/flash/clrun.html', 'Run']
    ];
    for (const [id, title] of classics) {
      const started = Date.now();
      game = await open(id);
      let state;
      if (title === '2048') {
        await game.locator('.tile').first().waitFor({ timeout: 15000 });
        const before = await game.locator('.tile-container').innerHTML();
        await game.locator('.game-container').click();
        for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) { await page.keyboard.press(key); await page.waitForTimeout(110); }
        await page.waitForTimeout(150);
        assert.notEqual(await game.locator('.tile-container').innerHTML(), before, 'Actual arrow keys must move/create tiles');
        state = { tiles: await game.locator('.tile').count() };
      } else if (title === 'Hextris') {
        await game.locator('#canvas').waitFor();
        const readyFrame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
        await readyFrame.waitForFunction(() => window.MainHex && typeof window.gameState === 'number');
        await game.locator('#startBtn').click({ timeout: 15000 });
        const frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
        await frame.waitForFunction(() => window.gameState === 1, null, { timeout: 15000 });
        // Original Hextris debounces rotation for75ms after creating its hex.
        await page.waitForTimeout(110);
        const before = await frame.evaluate(() => MainHex.position);
        await page.keyboard.press('ArrowLeft');
        state = await frame.evaluate(() => ({ gameState, position: MainHex.position, blocks: MainHex.blocks.length }));
        assert.notEqual(state.position, before, 'Actual arrow keys must rotate the game hexagon');
        await page.keyboard.press('p');
        await frame.waitForFunction(() => window.gameState === -1);
        await frame.waitForFunction(() => window.pausable === true);
        await page.keyboard.press('p');
        await frame.waitForFunction(() => window.gameState === 1);
      } else {
        const frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
        await frame.waitForFunction(() => document.querySelector('ruffle-player')?.ruffle?.().readyState === 2, { timeout: 15000 });
        // Ruffle publishes metadata shortly before its activation overlay settles.
        await page.waitForTimeout(850);
        await game.locator('ruffle-player').click();
        await frame.waitForFunction(() => document.querySelector('ruffle-player')?.ruffle?.().isPlaying, { timeout: 15000 });
        state = await frame.evaluate(() => {
          const api = document.querySelector('ruffle-player').ruffle();
          return { playing: api.isPlaying, frameRate: api.metadata.frameRate, width: api.metadata.width, height: api.metadata.height,
            swf: api.loadedConfig.url, script: document.querySelector('script[src*="ruffle.js"]').src };
        });
        assert.equal(new URL(state.swf, new URL(id, site)).origin, origin, title + ' must load the real local SWF');
      }
      console.log(JSON.stringify({ title, state }));
      const flash = title === 'Bloons' || title === 'Run';
      report.games.push({ title, ...(flash ? { engineActivationMs: Date.now() - started } : { inputReadyMs: Date.now() - started }), state });
      report.checks.push(flash ? title + ' loads its local SWF and responds to Ruffle activation with outside hosts blocked; a separate settled visual check confirms the original game menu' : title + ' starts and responds to real game input with all outside game/CDN hosts blocked');
      await page.screenshot({ path: '/tmp/turbogames-local-' + title.toLowerCase() + '.png' });
    }
    const unityStarted = Date.now();
    game = await open('library-source/html5-games/clblockblast.html');
    await game.locator('#unity-canvas').waitFor();
    const unityFrame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
    await unityFrame.waitForFunction(() => typeof window.createUnityInstance === 'function' && document.querySelector('#unity-loading-bar').style.display === 'none', null, { timeout: 45000 });
    const unityInitializationMs = Date.now() - unityStarted;
    const unityState = await unityFrame.evaluate(() => ({ loadingHidden: document.querySelector('#unity-loading-bar').style.display === 'none', width: document.querySelector('#unity-canvas').width, height: document.querySelector('#unity-canvas').height }));
    assert.deepEqual(new Set(unityBuildResponses.map(response => response.file)), new Set(['BlockBlast1.1-8.loader.js', 'BlockBlast1.1-8.framework.js.unityweb', 'BlockBlast1.1-8.wasm.unityweb', 'BlockBlast1.1-8.data.unityweb']));
    assert.ok(unityBuildResponses.every(response => response.status === 200));
    assert.ok(unityState.loadingHidden && unityState.width > 0 && unityState.height > 0);
    // Unity's own splash can outlast initialization. Do not use it as a cover
    // or claim that metadata alone is a complete game scene/playthrough.
    await page.waitForTimeout(8500);
    await page.screenshot({ path: '/tmp/turbogames-local-block-blast.png' });
    report.games.push({ title: 'Block Blast', unityInitializationMs, sceneSnapshotAfterMs: Date.now() - unityStarted, state: unityState, buildResponses: unityBuildResponses });
    report.checks.push('The exact existing Block Blast Unity build initializes with every outside host blocked; all four local build requests return 200 and the real loading overlay is dismissed');
    assert.deepEqual(failures, [], 'Localized assets must not return errors');
    assert.deepEqual(pageErrors, [], 'Localized core startup/input must have no uncaught errors');
    assert.deepEqual(dialogs, [], 'Localized games must not report a startup alert');
    report.blockedOptionalHosts = [...new Set(blocked)];
    report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.error = error.stack; throw error; }
  finally { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); if (api) await api.dispose(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
