#!/usr/bin/env node
/* Capture real emulator title/game screens for entries that lack exact cover art. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.TURBO_BASE_URL || 'http://127.0.0.1:8030/';
const concurrency = Math.max(1, Number(process.env.TURBO_CAPTURE_WORKERS || 12));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8').split('=', 2)[1].trim().replace(/;$/, ''));
const artworkPath = path.join(root, 'artwork.json');
const artwork = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));
const jobs = catalog.filter(item => item.category === 'emulator' && artwork[item.id]?.type !== 'source-artwork');
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
    await sleep(800);
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"], input[type="button"]')];
      const start = buttons.find(node => /^(play|start|launch|run)( game)?$/i.test((node.innerText || node.value || '').trim()))
        || document.querySelector('#startButton');
      if (start && getComputedStyle(start).display !== 'none') start.click();
    });
    await sleep(10000);
    const state = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const lower = text.toLowerCase();
      const bad = ['page not found', '404 not found', 'failed to load', 'error occurred', 'invalid rom', 'network error'];
      if (bad.some(value => lower.includes(value))) return { ok: false, reason: text.slice(0, 180) };
      const canvas = document.querySelector('canvas');
      if (!canvas || canvas.width < 64 || canvas.height < 64) return { ok: false, reason: 'emulator canvas did not start' };
      const loading = [...document.querySelectorAll('*')].some(node => {
        if (node.children.length || getComputedStyle(node).display === 'none') return false;
        return /^(loading|downloading|preparing)(\.{0,3}|[ :].*)$/i.test((node.textContent || '').trim());
      });
      if (loading) return { ok: false, reason: 'emulator still loading' };
      return { ok: true };
    });
    if (!state.ok) throw new Error(state.reason);
    const relative = `assets/covers/original/emulator-${safeName(item.id)}.jpg`;
    await page.screenshot({ path: path.join(root, relative), type: 'jpeg', quality: 84 });
    artwork[item.id] = {
      image: relative,
      type: 'source-artwork',
      source: item.source,
      attribution: 'Actual title/game screen captured from the bundled emulator source; rights remain with respective creators.',
      captureType: 'emulated game title screen'
    };
    return { id: item.id, title: item.title, ok: true, image: relative, pageErrors: errors.slice(0, 2) };
  } catch (error) {
    return { id: item.id, title: item.title, ok: false, error: error.message, pageErrors: errors.slice(0, 3) };
  } finally {
    await page.close();
  }
}

(async () => {
  console.log(`Capturing ${jobs.length} emulator entries with ${concurrency} workers`);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= jobs.length) return;
      results[index] = await capture(browser, jobs[index]);
      const done = results.filter(Boolean).length;
      if (done % 10 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}; captured ${results.filter(x => x?.ok).length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await browser.close();
  fs.writeFileSync(artworkPath, JSON.stringify(artwork, null, 2) + '\n');
  const report = { generatedAt: new Date().toISOString(), attempted: jobs.length,
    captured: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, results };
  fs.writeFileSync(path.join(root, 'reports', 'emulator-artwork-captures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ attempted: report.attempted, captured: report.captured, failed: report.failed }));
})().catch(error => { console.error(error); process.exitCode = 1; });
