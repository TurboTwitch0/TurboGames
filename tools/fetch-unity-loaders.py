import sys,json,hashlib,concurrent.futures,urllib.request,urllib.parse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent));from audit_library import Resources
root=Path(__file__).resolve().parent.parent;urls={}
for p in (root/'library-source').rglob('*.htm*'):
 if p.stat().st_size>1000000:continue
 s=p.read_text(errors='replace')
 if 'UnityLoader.instantiate' not in s:continue
 a=Resources();a.feed(s)
 for r in a.resources:
  if r['tag']=='script' and ('unityloader' in r['url'].lower() or r['url'].endswith('/2.7.js')):
   url=urllib.parse.urljoin(a.base or '',r['url'])
   if url.startswith('http'):urls.setdefault(url,[]).append(str(p.relative_to(root)))
out=Path('/tmp/turbogames-unity-assets/loaders');out.mkdir(parents=True,exist_ok=True)
def get(pair):
 url,refs=pair;name=hashlib.sha256(url.encode()).hexdigest()[:16]+'.js'
 try:
  with urllib.request.urlopen(url,timeout=30) as r:data=r.read(3000000)
  (out/name).write_bytes(data)
  return {'url':url,'file':name,'references':refs,'bytes':len(data)}
 except Exception as e:return {'url':url,'references':refs,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(get,urls.items()))
Path('/tmp/turbo-unity-loaders.json').write_text(json.dumps(results,indent=2))
print('loaders',len(results),'downloaded',sum('file'in x for x in results))
