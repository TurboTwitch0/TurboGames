// Regression: real browser fetches of both Ruffle WASM variants from the
// opaque game origin must work with the same _headers used on Netlify.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const base = process.env.TURBO_TEST_URL || 'http://127.0.0.1:8010/';
  const browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    await page.goto(base + '?play=orbit-breaker');
    const handle = await page.locator('#game-frame').elementHandle();
    const frame = await handle.contentFrame();
    await frame.waitForFunction(() => document.querySelector('canvas'));
    const names = fs.readdirSync(path.join(__dirname, '../vendor/ruffle')).filter(name => name.endsWith('.wasm'));
    const results = await frame.evaluate(async ({base, names}) => {
      let isolated = false;
      try { void parent.document; } catch { isolated = true; }
      const files = [];
      for (const name of names) {
        const response = await fetch(new URL('vendor/ruffle/' + name, base));
        const data = new Uint8Array(await response.arrayBuffer());
        files.push({name, status: response.status, type: response.headers.get('content-type'), bytes: data.length, magic: [...data.slice(0, 4)]});
      }
      return {isolated, files};
    }, {base, names});
    assert.equal(results.isolated, true);
    assert.equal(results.files.length, 2);
    for (const file of results.files) {
      assert.equal(file.status, 200);
      assert.equal(file.type, 'application/wasm');
      assert.deepEqual(file.magic, [0, 97, 115, 109]);
      assert.ok(file.bytes > 1000000);
    }
    fs.writeFileSync(path.join(__dirname, '../reports/ruffle-cors-regression.json'), JSON.stringify({passed:true, ...results}, null, 2));
    console.log(JSON.stringify({passed:true, ...results}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
