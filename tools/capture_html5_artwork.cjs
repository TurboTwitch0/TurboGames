#!/usr/bin/env node
/* Capture real title/game screens for HTML5 catalog entries that still use illustrations. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.TURBO_BASE_URL || 'http://127.0.0.1:8030/';
const concurrency = Math.max(1, Number(process.env.TURBO_CAPTURE_WORKERS || 8));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8').split('=', 2)[1].trim().replace(/;$/, ''));
const artworkPath = path.join(root, 'artwork.json');
const artwork = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));
const jobs = catalog.filter(item => item.category === 'games' && artwork[item.id]?.type !== 'source-artwork');
const outputDir = path.join(root, 'assets', 'covers', 'original');
fs.mkdirSync(outputDir, { recursive: true });
const safeName = id => id.replace(/[^a-zA-Z0-9._-]+/g, '-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(browser, item) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  page.on('pageerror', error => errors.push(error.message));
  try {
    const url = new URL(item.source.split('/').map(encodeURIComponent).join('/'), base).href;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
    await sleep(2500);
    // Some ports render a black canvas until their first keyboard/pointer input.
    await page.mouse.click(256, 256).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.keyboard.press('Space').catch(() => {});
    await sleep(5000);
    const state = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const lower = text.toLowerCase();
      const bad = ['page not found', '404 not found', 'failed to load', 'error occurred', 'access denied'];
      if (bad.some(value => lower.includes(value))) return { ok: false, reason: text.slice(0, 160) };
      if (/^(loading|loading\.\.\.|please wait)[ .0-9%/a-z]*$/i.test(text)) return { ok: false, reason: text.slice(0, 160) };
      const visual = document.querySelector('canvas, iframe, img, svg, video, [style*="background-image"]');
      if (!visual && text.length < 20) return { ok: false, reason: 'no rendered game content' };
      return { ok: true, text: text.slice(0, 160) };
    });
    if (!state.ok) throw new Error(state.reason || 'invalid page');
    const relative = `assets/covers/original/html5-${safeName(item.id)}.jpg`;
    await page.screenshot({ path: path.join(root, relative), type: 'jpeg', quality: 84 });
    artwork[item.id] = {
      image: relative,
      type: 'source-artwork',
      source: item.source,
      attribution: 'Actual title/game screen captured from the bundled HTML5 source; rights remain with respective creators.',
      captureType: 'game title screen'
    };
    return { id: item.id, title: item.title, ok: true, image: relative, pageErrors: errors.slice(0, 2) };
  } catch (error) {
    return { id: item.id, title: item.title, ok: false, error: error.message, pageErrors: errors.slice(0, 3) };
  } finally {
    await page.close();
  }
}

(async () => {
  console.log(`Capturing ${jobs.length} HTML5 entries with ${concurrency} workers`);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']
  });
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= jobs.length) return;
      results[index] = await capture(browser, jobs[index]);
      const done = results.filter(Boolean).length;
      if (done % 10 === 0 || done === jobs.length) {
        console.log(`${done}/${jobs.length}; captured ${results.filter(x => x?.ok).length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await browser.close();
  fs.writeFileSync(artworkPath, JSON.stringify(artwork, null, 2) + '\n');
  const report = {
    generatedAt: new Date().toISOString(), attempted: jobs.length,
    captured: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, results
  };
  fs.writeFileSync(path.join(root, 'reports', 'html5-artwork-captures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ attempted: report.attempted, captured: report.captured, failed: report.failed }));
})().catch(error => { console.error(error); process.exitCode = 1; });
