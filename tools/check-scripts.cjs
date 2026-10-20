/* Parse inline JavaScript without executing downloaded game code. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'catalog.js'),'utf8');
const items=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
const failures=[];let scripts=0,modules=0;
for(const item of items){
 const html=fs.readFileSync(path.join(root,item.source),'utf8');let number=0;
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  number++;const attrs=match[1],body=match[2];if(/\bsrc\s*=/i.test(attrs)||!body.trim())continue;
  const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
  if(type&&!['text/javascript','application/javascript','module'].includes(type))continue;
  try{if(type==='module'){new vm.SourceTextModule(body,{identifier:item.source+':'+number});modules++}else{new vm.Script(body,{filename:item.source+':'+number});scripts++}}
  catch(error){failures.push({title:item.title,source:item.source,script:number,error:error.message})}
 }
}
const report={method:'Parse inline classic and module JavaScript without execution; remote scripts not checked',items:items.length,scripts,modules,failures};
fs.writeFileSync(path.join(root,'reports/script-syntax.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({items:items.length,scripts,modules,failures:failures.length}));for(const f of failures.slice(0,15))console.log(JSON.stringify(f));
