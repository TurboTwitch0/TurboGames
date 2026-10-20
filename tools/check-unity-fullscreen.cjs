// Requires tools/unity-fixture-server.py --download on localhost:8012.
const {chromium} = require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const items=JSON.parse(fs.readFileSync(root+'/catalog.js','utf8').replace(/^window.TURBO_CATALOG\s*=\s*/,'').replace(/;\s*$/,''));
const item=items.find(x=>x.source.endsWith('/clyanderesimulator.html'));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
 const results=[];
 try {
  for(const version of ['before','after']) {
   const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[],bad=[];
   page.on('dialog',async d=>{errors.push(d.message());await d.dismiss()});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()})});
   const source=(version==='before'?require('node:child_process').execFileSync('git',['show','d196755:'+item.source],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/'+item.source,'utf8')).replaceAll('https://cdn.jsdelivr.net/gh/bubblfan/web-port@master/yandere-simulator/','http://127.0.0.1:8012/__unity-test/');
   await page.route('**/'+item.source,r=>r.fulfill({contentType:'text/html',body:source}));
   await page.goto('http://127.0.0.1:8012/?play='+item.id);
   const frame=await(await page.locator('#game-frame').elementHandle()).contentFrame();
   await frame.waitForSelector('#unityContainer');
   let started=false;
   try{await frame.waitForFunction(()=>!document.querySelector('#loading-text'),{},{timeout:version==='before'?12000:120000});started=true}catch{}
   let fullscreen=false;
   if(version==='after'){
    await page.getByRole('button',{name:'Go fullscreen',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement?.id==='player-surface');
    fullscreen=true;
    await page.getByRole('button',{name:'Go fullscreen',exact:true}).click();
    await page.waitForFunction(()=>!document.fullscreenElement);
   }
   const state=await frame.evaluate(()=>({text:document.body.innerText.slice(0,500),canvas:!!document.querySelector('canvas'),webgl:typeof WebGLRenderingContext!=='undefined'}));
   results.push({version,started,fullscreen,errors,bad,state});
   await page.screenshot({path:'/tmp/yandere-'+version+'.png'});
   console.log(JSON.stringify(results.at(-1)));
   await page.close();
  }
  fs.writeFileSync(root+'/reports/unity-fullscreen-check.json',JSON.stringify({method:'Real public Unity assets downloaded with TLS verification, served locally to avoid cloud browser CA limitation. Startup check, not full playthrough.',results},null,2));
  assert.equal(results[0].started,false);
  assert.equal(results[1].started,true);
  assert.equal(results[1].fullscreen,true);
  assert.equal(results[1].bad.length,0);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
