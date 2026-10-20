#!/usr/bin/env python3
"""Check literal script/iframe and complete asset URLs; not a gameplay test."""
import concurrent.futures, json, re, urllib.request, urllib.parse, time
from pathlib import Path
from datetime import datetime, timezone
from audit_library import Resources
ROOT=Path(__file__).resolve().parent.parent
catalog=json.loads((ROOT/'catalog.js').read_text().split('=',1)[1].strip().rstrip(';'))
cache_path=ROOT/'reports/remote-audit-current.json'
cache={r['url']:r for r in json.loads(cache_path.read_text())['results']} if cache_path.exists() else {}
urls={}
def add(url,source,kind):
    if not url.startswith(('https://','http://')):return
    if any(x in url for x in ['googletagmanager','google-analytics','doubleclick','cloudflareinsights']):return
    url=urllib.parse.quote(url,safe=":/?&=%@+!$'()*,-._~#")
    urls.setdefault(url,[]).append({'source':source,'kind':kind})
for item in catalog:
    p=ROOT/item['source']
    if p.stat().st_size>1000000:continue
    source=p.read_text(errors='replace');parser=Resources()
    try:parser.feed(source)
    except Exception:continue
    base=urllib.parse.urljoin('https://turbogames.local/'+item['source'],parser.base or '')
    for r in parser.resources:
        if r['tag'] not in ('script','iframe'):continue
        url=urllib.parse.urljoin(base,r['url'])
        if 'turbogames.local' not in url:add(url,item['source'],r['tag'])
    for match in re.finditer(r'''\b(dataUrl|codeUrl|frameworkUrl|wasmCodeUrl|wasmFrameworkUrl|EJS_gameUrl|SWF_URL)\s*[:=]\s*(["'])(https?://(?:\\.|(?!\2)[^\\])*)\2''',source):
        url=match[3].replace("\\\'", "\'").replace("\\/", "/")
        # Exclude intentionally split prefixes; the parts are audited separately.
        if 'part' in source and re.search(r'\.(?:data|wasm|z64|zip|nds|gba|unityweb)(?:\.br|\.gz)?$',url):continue
        add(url,item['source'],match[1])

def check(pair):
    url,refs=pair
    if url in cache and cache[url].get('status') in (200,206):
        return {**cache[url],'references':refs,'reusedSuccessfulCheck':True}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 TurboGames-dependency-check'})
        with urllib.request.urlopen(req,timeout=18) as r:
            data=r.read(256)
            return {'url':url,'references':refs,'status':r.status,'contentType':r.headers.get('Content-Type'),'cors':r.headers.get('Access-Control-Allow-Origin'),'prefix':data[:64].decode('utf8','replace')}
    except Exception as e:return {'url':url,'references':refs,'status':getattr(e,'code',None),'error':str(e)}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
 for i,result in enumerate(pool.map(check,urls.items()),1):
    results.append(result)
    if i%200==0:print('Checked',i,'/',len(urls),flush=True)
report={'at':datetime.now(timezone.utc).isoformat(),'method':'GET prefix (failed initial Range checks retried without Range), literal script/iframe URLs and complete config assets. HTTP availability is not gameplay verification; optional scripts can fail without breaking games. Large embedded bundles excluded from remote extraction.','count':len(results),'results':results}
(ROOT/'reports/remote-audit-current.json').write_text(json.dumps(report,indent=2)+'\n')
print('Done',len(results),'Failed',sum(not x.get('status') or x['status']>=400 for x in results))
