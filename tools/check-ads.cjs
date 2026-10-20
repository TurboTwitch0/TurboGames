const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const checks = [];
  const good = {enabled:true,publisherId:'ca-pub-1234567890123456',slotId:'1234567890'}; // Test-only IDs; no real ad requests.
  try {
    for (const scenario of [
      {name:'Disabled by default',config:null,requests:0},
      {name:'Reject invalid IDs',config:{...good,publisherId:'invalid'},requests:0},
      {name:'Skip Google Sites mode',config:good,query:'?embed=1',requests:0},
      {name:'One placement; no refresh on interactions',config:good,requests:1},
      {name:'Ad network failure does not block games',config:good,requests:1,fail:true},
      {name:'No-fill placement collapses',config:good,requests:1,unfilled:true}
    ]) {
      const page = await browser.newPage();
      let requests = 0;
      if(scenario.config) await page.route('**/ads-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.TURBO_ADS_CONFIG='+JSON.stringify(scenario.config)}));
      await page.route('https://pagead2.googlesyndication.com/**',async route=>{
        requests++;
        if(scenario.fail) return route.abort();
        await route.fulfill({contentType:'application/javascript',body:'window.adsbygoogle=[];',headers:{'access-control-allow-origin':'*'}});
      });
      await page.goto('http://127.0.0.1:8010/'+(scenario.query||''));
      await page.waitForTimeout(200);
      assert.equal(requests,scenario.requests);
      if(scenario.unfilled) await page.locator('.adsbygoogle').evaluate(ad=>ad.dataset.adStatus='unfilled');
      if(!scenario.requests||scenario.fail||scenario.unfilled) await page.waitForFunction(()=>document.querySelector('#catalog-ad').hidden);
      else {
        assert.equal(await page.locator('#catalog-ad').isVisible(),true);
        assert.equal(await page.evaluate(()=>window.adsbygoogle.length),1);
      }
      await page.locator('#search').fill('Orbit Breaker');
      await page.getByRole('button',{name:'Open Orbit Breaker',exact:true}).click();
      await page.frameLocator('#game-frame').locator('canvas').waitFor();
      assert.equal(requests,scenario.requests);
      checks.push(scenario.name);
      await page.close();
    }
    fs.writeFileSync(path.join(__dirname,'../reports/ads-check.json'),JSON.stringify({passed:true,method:'Local browser checks with ad network mocked; no live ad traffic or earnings.',checks},null,2));
    console.log(JSON.stringify({passed:true,checks}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
