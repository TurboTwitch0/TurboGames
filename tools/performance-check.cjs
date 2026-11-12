/* Controlled local startup comparison, not a real-device/network speed claim. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const site = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8002/';
const baseline = process.env.TURBO_BASELINE_REF || 'e792405';
const reportPath = process.env.TURBO_REPORT_PATH || path.join(root, 'reports/performance-check.json');
const files = ['app.js', 'catalog.js'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Math.round(value * 100) / 100;

(async () => {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(site).hostname), 'This controlled benchmark is local only');
  const scripts = {
    before: Object.fromEntries(files.map(name => [name, execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root })])),
    after: Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(root, name))]))
  };
  const report = {
    passed: false,
    method: 'Controlled local Chromium startup comparison: three fresh contexts per mode,390×844 viewport,4× CPU slowdown. Both modes fulfill app.js and catalog.js from memory identically; current HTML,CSS and every other script are shared. Images use the real local server. Metrics are sampled750ms after the first cards enter the DOM. No game is opened. This is not a real Chromebook, a simulated slow connection, or a universal gameplay-time claim.',
    site, baseline, cpuSlowdown: 4, viewport: { width: 390, height: 844 },
    sampleWindowAfterFirstCardsMs: 750,
    scriptInputs: Object.fromEntries(Object.entries(scripts).map(([mode, sources]) => [mode,
      Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, { bytes: source.length, sha256: hash(source) }]))])),
    checks: [], samples: [], screenshots: []
  };
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    // Alternate the modes to reduce ordering bias from other work on this host.
    for (let trial = 1; trial <= 3; trial++) for (const mode of ['before', 'after']) {
      const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1 });
      try {
        await context.route(/\/(?:app|catalog)\.js(?:[?#]|$)/, route => {
          const name = new URL(route.request().url()).pathname.split('/').pop();
          return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: scripts[mode][name] });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        let requestsStarted = 0;
        let imageRequestsStarted = 0;
        const errors = [];
        page.on('request', incoming => { requestsStarted++; if (incoming.resourceType() === 'image') imageRequestsStarted++; });
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          window.__turboPerformance = { firstCardsAt: null, longTasks: [] };
          new PerformanceObserver(list => {
            window.__turboPerformance.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
          }).observe({ type: 'longtask', buffered: true });
          const observer = new MutationObserver(() => {
            if (document.querySelector('#game-grid .card-launch')) {
              window.__turboPerformance.firstCardsAt = performance.now();
              observer.disconnect();
            }
          });
          observer.observe(document, { childList: true, subtree: true });
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.goto(site, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__turboPerformance?.firstCardsAt !== null);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve,
          Math.max(0, window.__turboPerformance.firstCardsAt + 750 - performance.now()))));
        const snapshot = await page.evaluate(() => {
          const resources = performance.getEntriesByType('resource');
          const images = resources.filter(entry => entry.initiatorType === 'img');
          const audit = window.__turboPerformance;
          return {
            fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
            cardsReadyMs: audit.firstCardsAt,
            sampledAtMs: performance.now(),
            largestLongTaskMs: Math.max(0, ...audit.longTasks.map(entry => entry.duration)),
            totalLongTaskMs: audit.longTasks.reduce((sum, entry) => sum + entry.duration, 0),
            imageEncodedBodyBytes: images.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
            imageResponsesCompleted: images.length,
            completedResources: resources.length,
            catalogCount: window.TURBO_CATALOG.length,
            visibleCards: document.querySelectorAll('#game-grid .card-launch').length,
            longTasks: audit.longTasks
          };
        });
        assert.ok(Number.isFinite(snapshot.fcpMs), `${mode}${trial}: FCP was not observed`);
        assert.equal(snapshot.catalogCount, 3099);
        assert.ok(snapshot.visibleCards > 0);
        snapshot.requestsStarted = requestsStarted;
        snapshot.imageRequestsStarted = imageRequestsStarted;
        if (trial === 1) {
          const screenshot = `/tmp/turbogames-performance-${mode}.png`;
          await page.screenshot({ path: screenshot, animations: 'disabled' });
          report.screenshots.push(screenshot);
        }
        const queries = {};
        // Mario intentionally gains the corrected Doki Doki Mario 64 title;
        // compare unaffected queries rather than treating that fix as a loss.
        for (const query of ['Orbit Breaker', 'tetris', 'puzzle']) {
          await page.locator('#search').fill(query);
          await page.waitForFunction(query => new URL(location.href).searchParams.get('q') === query, query);
          queries[query] = await page.evaluate(() => ({
            resultCount: Number(document.querySelector('#result-count').textContent.match(/[\d,]+/)[0].replaceAll(',', '')),
            renderedIds: [...document.querySelectorAll('#game-grid [data-save-id]')].map(node => node.dataset.saveId)
          }));
        }
        assert.deepEqual(errors, [], `${mode}${trial}: parent JavaScript errors`);
        report.samples.push({ mode, trial, ...snapshot, queries });
        console.log(JSON.stringify({ mode, trial, fcpMs: round(snapshot.fcpMs), largestLongTaskMs: round(snapshot.largestLongTaskMs), imageEncodedBodyBytes: snapshot.imageEncodedBodyBytes, requestsStarted: snapshot.requestsStarted }));
      } finally { await context.close(); }
    }
    const metrics = ['fcpMs', 'cardsReadyMs', 'largestLongTaskMs', 'totalLongTaskMs', 'imageEncodedBodyBytes', 'requestsStarted', 'imageRequestsStarted', 'completedResources'];
    report.medians = Object.fromEntries(['before', 'after'].map(mode => [mode,
      Object.fromEntries(metrics.map(metric => [metric, round(median(report.samples.filter(sample => sample.mode === mode).map(sample => sample[metric])))]))]));
    const first = report.samples[0];
    for (const sample of report.samples) {
      assert.equal(sample.catalogCount, first.catalogCount);
      assert.deepEqual(sample.queries, first.queries, `${sample.mode}${sample.trial}: sampled query results must remain unchanged`);
    }
    assert.ok(report.medians.after.imageEncodedBodyBytes < report.medians.before.imageEncodedBodyBytes,
      'Current homepage image bytes should be lower than the baseline under the same conditions');
    report.reductionPercent = Object.fromEntries(metrics.map(metric => [metric,
      report.medians.before[metric] ? round(100 * (report.medians.before[metric] - report.medians.after[metric]) / report.medians.before[metric]) : null]));
    report.checks.push('Six fresh contexts use the same current page and identical memory-fulfilled script mechanism, with alternating modes and4× CPU slowdown');
    report.checks.push('All3099 catalog entries and three sampled query result sets match across all baseline/current samples');
    report.checks.push('Median completed homepage image bytes750ms after first cards are lower; CPU/FCP timings are recorded without a noise-sensitive pass threshold');
    report.passed = true;
    console.log(JSON.stringify({ passed: true, medians: report.medians, reductionPercent: report.reductionPercent }));
  } catch (error) { report.error = error.stack; throw error; }
  finally { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
