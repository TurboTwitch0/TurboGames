#!/usr/bin/env node
/* Retry remaining artwork through the real TurboGames player and compatibility layer. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.TURBO_BASE_URL || 'http://127.0.0.1:8030/';
const concurrency = Math.max(1, Number(process.env.TURBO_CAPTURE_WORKERS || 6));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8').split('=', 2)[1].trim().replace(/;$/, ''));
const artworkPath = path.join(root, 'artwork.json');
const artwork = JSON.parse(fs.readFileSync(artworkPath, 'utf8'));
const jobs = catalog.filter(item => artwork[item.id]?.type !== 'source-artwork' && item.sourceStatus !== 'unavailable');
const outputDir = path.join(root, '.artwork-review', 'player');
fs.mkdirSync(outputDir, { recursive: true });
const safeName = id => id.replace(/[^a-zA-Z0-9._-]+/g, '-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(browser, item) {
  const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  page.on('pageerror', error => errors.push(error.message));
  try {
    const url = new URL(base);
    url.searchParams.set('play', item.id);
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#game-frame')?.hasAttribute('srcdoc'), null, { timeout: 20000 });
    await sleep(1200);
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    if (!frame) throw new Error('player frame did not open');
    await frame.evaluate(() => {
      const root = document.querySelector('ruffle-player')?.shadowRoot;
      const rufflePlay = root?.querySelector('#play-button');
      if (rufflePlay && getComputedStyle(rufflePlay).display !== 'none') rufflePlay.click();
      const controls = [...document.querySelectorAll('button, [role="button"], input[type="button"]')];
      const start = controls.find(node => /^(play|start|launch|run)( game)?$/i.test((node.innerText || node.value || '').trim()))
        || document.querySelector('#startButton');
      if (start && getComputedStyle(start).display !== 'none') start.click();
    }).catch(() => {});
    await sleep(3500);
    await frame.mouse.click(256, 256).catch(() => {});
    await frame.keyboard.press('Enter').catch(() => {});
    await frame.keyboard.press('Space').catch(() => {});
    await sleep(6500);
    const state = await frame.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const lower = text.toLowerCase();
      const bad = ['page not found', '404 not found', 'failed to load', 'error occurred', 'settings network error', 'invalid rom', 'access denied'];
      if (bad.some(value => lower.includes(value))) return { ok: false, reason: text.slice(0, 180) };
      const root = document.querySelector('ruffle-player')?.shadowRoot;
      const visible = selector => { const node = root?.querySelector(selector); return node && !node.classList.contains('hidden') && getComputedStyle(node).display !== 'none'; };
      if (visible('#panic') || visible('#play-button')) return { ok: false, reason: 'Ruffle did not start' };
      if (/^(loading|downloading|preparing|please wait)(\.{0,3}|[ :].*)$/i.test(text)) return { ok: false, reason: text.slice(0, 180) };
      const visual = document.querySelector('canvas, iframe, img, svg, video, ruffle-player, [style*="background-image"]');
      if (!visual && text.length < 20) return { ok: false, reason: 'no rendered game content' };
      return { ok: true };
    });
    if (!state.ok) throw new Error(state.reason);
    const relative = `.artwork-review/player/player-${safeName(item.id)}.jpg`;
    await page.locator('#game-frame').screenshot({ path: path.join(root, relative), type: 'jpeg', quality: 84, timeout: 30000 });
    return { id: item.id, title: item.title, category: item.category, ok: true, image: relative, quality: 'unreviewed-candidate', pageErrors: errors.slice(0, 3) };
  } catch (error) {
    return { id: item.id, title: item.title, category: item.category, ok: false, error: error.message, pageErrors: errors.slice(0, 3) };
  } finally { await page.close(); }
}

(async () => {
  console.log(`Retrying ${jobs.length} entries through the player with ${concurrency} workers`);
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const results = new Array(jobs.length); let next = 0;
  async function worker() {
    while (true) {
      const index = next++; if (index >= jobs.length) return;
      results[index] = await capture(browser, jobs[index]);
      const done = results.filter(Boolean).length;
      if (done % 10 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}; captured ${results.filter(x => x?.ok).length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await browser.close();
  const report = { generatedAt: new Date().toISOString(), attempted: jobs.length,
    captured: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, results };
  fs.writeFileSync(path.join(root, 'reports', 'player-artwork-captures.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ attempted: report.attempted, captured: report.captured, failed: report.failed }));
})().catch(error => { console.error(error); process.exitCode = 1; });
