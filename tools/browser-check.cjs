/* Integration checks. External assets use the existing trusted API client/proxy;
   no browser trust settings or TLS checks are disabled. */
const fs=require('node:fs'),path=require('node:path');
const {chromium,request}=require('playwright');
const root=path.resolve(__dirname,'..');const raw=fs.readFileSync(path.join(root,'catalog.js'),'utf8');const items=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
const site=process.env.TURBO_TEST_URL||'http://127.0.0.1:8001/';
const args=process.argv.slice(2);const wanted=args.length?args:['games/orbit-breaker.html','library-source/html5-games/cl2048.html','library-source/flash/cl10bullets.html','library-source/html5-games/clhextris.html','library-source/html5-games/cl1.html','library-source/html5-games/clgolddiggerfrvr.html','library-source/emulated/nes/cltetris.html','library-source/html5-games/clColorboxmustard.html'];
const results=[];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const source of wanted){
  const item=items.find(x=>x.source===source);if(!item){results.push({source,missingCatalog:true});continue}
  const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
  const api=await request.newContext({...(proxy?{proxy:{server:proxy}}:{}),timeout:25000});
  const page=await browser.newPage({viewport:{width:1100,height:800}});const errors=[],requests=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,300)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text().slice(0,300))});
  await page.route(/^https?:\/\//,async route=>{
   const req=route.request(),url=req.url(),host=new URL(url).hostname;
   if(host==='127.0.0.1'||host==='localhost')return route.continue();
   if(/googletagmanager|google-analytics|doubleclick|pagead|cloudflareinsights|adver|adsterra/i.test(host))return route.fulfill({status:204,body:''});
   try{const response=await api.fetch(url,{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{data:req.postDataBuffer()}:{}),failOnStatusCode:false});if(response.status()>=400)requests.push({url,status:response.status()});await route.fulfill({response});await response.dispose()}
   catch(error){requests.push({url,error:String(error.message).split('\n')[0].slice(0,220)});await route.abort().catch(()=>{})}
  });
  try{
   await page.goto(site+'?play='+encodeURIComponent(item.id),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForTimeout(5000);
   const frame=await page.locator('#game-frame').elementHandle().then(e=>e.contentFrame());
   const start=frame.locator('#startButton');if(await start.count()&&await start.isVisible()){await start.click();await page.waitForTimeout(10000)}else await page.waitForTimeout(3000);
   const state=await frame.evaluate(()=>{function countCanvases(node){let count=node.querySelectorAll('canvas').length;for(const e of node.querySelectorAll('*'))if(e.shadowRoot)count+=countCanvases(e.shadowRoot);return count}let storage;try{localStorage.setItem('turbo-browser-check','1');storage=localStorage.getItem('turbo-browser-check')==='1'}catch{storage=false}return{title:document.title,text:document.body?.innerText.slice(0,450),canvases:countCanvases(document),iframes:document.querySelectorAll('iframe').length,storage,gridTiles:document.querySelectorAll('.tile,.tile-inner').length}});
   const result={title:item.title,source,state,errors:[...new Set(errors)],consoleErrors:[...new Set(consoleErrors)],environmentTLSBlocked:consoleErrors.some(e=>e.includes('ERR_CERT_AUTHORITY_INVALID')),failedRequests:requests};results.push(result);
   fs.mkdirSync(path.join(root,'reports/browser-screenshots'),{recursive:true});await page.screenshot({path:path.join(root,'reports/browser-screenshots',source.split('/').at(-1).replace(/\.html?$/i,'.png'))});
   console.log(JSON.stringify({title:item.title,canvases:state.canvases,storage:state.storage,errors:errors.length,failedRequests:requests.length,text:state.text?.slice(0,100)}));
  }catch(error){results.push({title:item.title,source,error:error.message});console.log(JSON.stringify({title:item.title,error:error.message.slice(0,300)}))}
  await page.close();await api.dispose();
  fs.writeFileSync(path.join(root,'reports/browser-check.json'),JSON.stringify({method:'Browser render/start-screen checks, not complete playthroughs. Remote source availability is checked separately. Some sandbox iframe subrequests in this managed browser bypass interception and may fail its environment CA trust; these are marked environmentTLSBlocked. No TLS checks were disabled.',results},null,2));
 }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
