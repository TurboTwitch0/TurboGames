#!/usr/bin/env node
/* Capture real title/game screens for catalogued Flash files that still use illustrations. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.TURBO_BASE_URL || 'http://127.0.0.1:8030/';
const concurrency = Math.max(1, Number(process.env.TURBO_CAPTURE_WORKERS || 6));
const catalogText = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const catalog = JSON.parse(catalogText.split('=', 2)[1].trim().replace(/;$/, ''));
const artworkPath = path.join(root, 'artwork.json');
const artwork = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));
const jobs = catalog.filter(item => item.category === 'flash' && artwork[item.id]?.type !== 'source-artwork');
const outputDir = path.join(root, 'assets', 'covers', 'original');
fs.mkdirSync(outputDir, { recursive: true });

const safeName = id => id.replace(/[^a-zA-Z0-9._-]+/g, '-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(browser, item) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  try {
    const url = new URL(item.source.split('/').map(encodeURIComponent).join('/'), base).href;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('ruffle-player', { timeout: 15000 });
    await sleep(1000);
    await page.evaluate(() => {
      const root = document.querySelector('ruffle-player')?.shadowRoot;
      const button = root?.querySelector('#play-button');
      if (button && getComputedStyle(button).display !== 'none') button.click();
    });
    await sleep(7000);
    const state = await page.evaluate(() => {
      const root = document.querySelector('ruffle-player')?.shadowRoot;
      if (!root) return { ok: false, reason: 'missing player' };
      const visible = selector => {
        const node = root.querySelector(selector);
        return node && !node.classList.contains('hidden') && getComputedStyle(node).display !== 'none';
      };
      if (visible('#panic')) return { ok: false, reason: 'Ruffle panic screen' };
      if (visible('#play-button')) return { ok: false, reason: 'play screen remained visible' };
      if (!root.querySelector('canvas')) return { ok: false, reason: 'missing game canvas' };
      return { ok: true };
    });
    if (!state.ok) throw new Error(state.reason);
    const relative = `assets/covers/original/flash-${safeName(item.id)}.jpg`;
    await page.screenshot({ path: path.join(root, relative), type: 'jpeg', quality: 84 });
    artwork[item.id] = {
      image: relative,
      type: 'source-artwork',
      source: item.source,
      attribution: 'Actual title/game screen captured from the bundled Flash source; rights remain with respective creators.',
      captureType: 'game title screen'
    };
    return { id: item.id, title: item.title, ok: true, image: relative };
  } catch (error) {
    return { id: item.id, title: item.title, ok: false, error: error.message, pageErrors: failures.slice(0, 3) };
  } finally {
    await page.close();
  }
}

(async () => {
  console.log(`Capturing ${jobs.length} Flash entries with ${concurrency} workers`);
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
    generatedAt: new Date().toISOString(),
    attempted: jobs.length,
    captured: results.filter(x => x.ok).length,
    failed: results.filter(x => !x.ok).length,
    results
  };
  fs.writeFileSync(path.join(root, 'reports', 'flash-artwork-captures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ attempted: report.attempted, captured: report.captured, failed: report.failed }));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
