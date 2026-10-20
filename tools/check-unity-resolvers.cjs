// Run fetch-unity-loaders.py and unity-fixture-server.py first.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const loaders=JSON.parse(fs.readFileSync('/tmp/turbo-unity-loaders.json','utf8')).filter(x=>x.file);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const results=[];
 try{for(const loader of loaders){
  const page=await browser.newPage();
  try{
   await page.goto('http://127.0.0.1:8012/?play=orbit-breaker');
   const frame=await(await page.locator('#game-frame').elementHandle()).contentFrame();await frame.waitForSelector('canvas');
   await frame.evaluate(()=>Object.defineProperty(window,'UnityLoader',{configurable:true,writable:true,value:undefined}));
   await frame.addScriptTag({content:fs.readFileSync('/tmp/turbogames-unity-assets/loaders/'+loader.file,'utf8')});
   const before=await frame.evaluate(()=>{
    const e=document.createElement('div');document.body.append(e);
    const i=UnityLoader.instantiate(e,'https://example.org/Build/game.json',{compatibilityCheck:()=>{}});
    const urls=['blob:null/turbo-game-data','data:application/octet-stream;base64,AA==','https://example.org/game.wasm','game.data'];
    return urls.map(url=>i.Module.resolveBuildUrl(url));
   });
   await frame.evaluate(()=>window.__TURBOGAMES_CONFIG__={turboGames:1,nonce:'test',parentOrigin:'http://127.0.0.1:8012',local:{},session:{}});
   await frame.addScriptTag({content:fs.readFileSync(root+'/player-compat.js','utf8')});
   const after=await frame.evaluate(()=>{
    const e=document.createElement('div');document.body.append(e);
    const i=UnityLoader.instantiate(e,'https://example.org/Build/game.json',{compatibilityCheck:()=>{}});
    const urls=['blob:null/turbo-game-data','data:application/octet-stream;base64,AA==','https://example.org/game.wasm','game.data'];
    return urls.map(url=>i.Module.resolveBuildUrl(url));
   });
   assert.deepEqual(after.slice(0,3),['blob:null/turbo-game-data','data:application/octet-stream;base64,AA==','https://example.org/game.wasm']);assert.equal(after[3],before[3]);
   results.push({...loader,passed:true,correctedBlob:before[0]!==after[0],before,after});
  }catch(error){results.push({...loader,passed:false,error:error.message})}
  await page.close();if(results.length%10===0)console.log('Checked',results.length,'/',loaders.length);
 }
 const report={method:'Real upstream legacy Unity loaders, instantiated with network startup disabled. Tests complete URL preservation and unchanged relative URL resolution; not game playthroughs.',loaders:results.length,passed:results.filter(x=>x.passed).length,correctedBlob:results.filter(x=>x.correctedBlob).length,results};
 fs.writeFileSync(root+'/reports/unity-resolver-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({loaders:report.loaders,passed:report.passed,correctedBlob:report.correctedBlob}));
 if(report.passed!==report.loaders)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
