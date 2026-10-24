/* Parse inline JavaScript without executing downloaded game code. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const help=`Usage: node --experimental-vm-modules tools/check-scripts.cjs [options]

Parse catalog launchers' inline JavaScript without executing it.

Options:
  --output <path>  Write JSON report here (relative paths use the current directory).
                   Default: reports/script-syntax.json in the repository.
  --strict         Exit with status 1 when source or syntax failures are found.
  --help           Show this help.

The Node.js --experimental-vm-modules flag is required for inline module scripts.
Invalid arguments or unavailable module parsing exit with status 2.
`;

function main(){
let output=path.join(root,'reports/script-syntax.json'),strict=false,showHelp=false;
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 const arg=args[i];
 if(arg==='--help')showHelp=true;
 else if(arg==='--strict')strict=true;
 else if(arg==='--output'){
  const value=args[++i];
  if(!value||value.startsWith('--'))throw new Error('--output requires a file path.');
  output=path.resolve(process.cwd(),value);
 }else throw new Error('Unknown argument: '+arg);
}
if(showHelp){console.log(help);return;}
if(typeof vm.SourceTextModule!=='function')throw new Error('Inline module parsing requires Node.js --experimental-vm-modules. Run with --help for usage.');
const raw=fs.readFileSync(path.join(root,'catalog.js'),'utf8');
const items=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));
const failures=[];let scripts=0,modules=0;
for(const item of items){
 let html;let number=0;
 try{html=fs.readFileSync(path.join(root,item.source),'utf8');}
 catch(error){failures.push({title:item.title,source:item.source,script:0,error:'Source could not be read: '+error.message});continue;}
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  number++;const attrs=match[1],body=match[2];if(/\bsrc\s*=/i.test(attrs)||!body.trim())continue;
  const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
  if(type&&!['text/javascript','application/javascript','module'].includes(type))continue;
  try{if(type==='module'){new vm.SourceTextModule(body,{identifier:item.source+':'+number});modules++}else{new vm.Script(body,{filename:item.source+':'+number});scripts++}}
  catch(error){failures.push({title:item.title,source:item.source,script:number,error:error.message})}
 }
}
const report={method:'Parse inline classic and module JavaScript without execution; remote scripts not checked',items:items.length,scripts,modules,failures};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({items:items.length,scripts,modules,failures:failures.length}));for(const f of failures.slice(0,15))console.log(JSON.stringify(f));
if(strict&&failures.length)process.exitCode=1;
}
try{main();}catch(error){console.error(error.message);process.exitCode=2;}
