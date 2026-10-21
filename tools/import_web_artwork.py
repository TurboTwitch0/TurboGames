#!/usr/bin/env python3
"""Import original artwork only from canonical pages with an exact game-title match."""
import concurrent.futures,hashlib,json,re,time,unicodedata,urllib.parse,urllib.request
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parent.parent
CACHE=Path('/tmp/turbo-miniplay-art-cache');CACHE.mkdir(exist_ok=True)
def normalized(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&','and'))
class Meta(HTMLParser):
 def __init__(self):super().__init__();self.values={}
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='meta' and a.get('property','').startswith('og:'):self.values[a['property']]=a.get('content','')
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TurboGames game artwork metadata importer'}),timeout=12) as r:return r.read(3000000)
def main():
 catalog=json.loads((ROOT/'catalog.js').read_text().split('=',1)[1].strip().rstrip(';'));art=json.loads((ROOT/'artwork.json').read_text())
 pending=[i for i in catalog if art[i['id']]['type']=='illustrated' and i['category'] in ('games','flash')]
 dest=ROOT/'assets/covers/original';dest.mkdir(parents=True,exist_ok=True)
 def process(i):
  name=unicodedata.normalize('NFKD',i['title']).encode('ascii','ignore').decode().lower().replace('&','and').replace("'",'')
  slug=re.sub('[^a-z0-9]+','-',name).strip('-')
  variants=[slug,re.sub(r'(\d)([a-z])|([a-z])(\d)',lambda m:(m[1]+'-'+m[2]) if m[1] else (m[3]+'-'+m[4]),slug)]
  for slug in dict.fromkeys(variants):
   if not slug:continue
   page='https://www.miniplay.com/game/'+slug;cache=CACHE/(slug+'.json')
   try:
    if cache.exists():v=json.loads(cache.read_text())
    else:
     p=Meta();p.feed(fetch(page).decode(errors='replace'));v=p.values;cache.write_text(json.dumps(v))
    if normalized(v.get('og:title',''))!=normalized(i['title']) or v.get('og:url','').rstrip('/')!=page or v.get('og:type')!='game':continue
    url=v.get('og:image','')
    if not url.startswith('https://'):continue
    data=fetch(url)
    ext='png' if data.startswith(b'\x89PNG') else 'jpg' if data.startswith(b'\xff\xd8\xff') else 'webp' if data[:4]==b'RIFF' and data[8:12]==b'WEBP' else None
    if not ext:continue
    local=dest/(hashlib.sha256(data).hexdigest()[:24]+'.'+ext);local.write_bytes(data)
    return i['id'],{'image':local.relative_to(ROOT).as_posix(),'type':'source-artwork','source':url,'sourcePage':page,'attribution':'Original game thumbnail from its exact-title Miniplay page; rights remain with respective creators.','matchedTitle':v['og:title']}
   except Exception:pass
  return None
 added={}
 with concurrent.futures.ThreadPoolExecutor(8) as pool:
  futures=[pool.submit(process,i) for i in pending]
  for n,f in enumerate(concurrent.futures.as_completed(futures),1):
   r=f.result()
   if r:added[r[0]]=r[1]
   if n%50==0:print('Looked up',n,'/',len(pending),'matched',len(added),flush=True)
 # Reload so another artwork import cannot be overwritten.
 art=json.loads((ROOT/'artwork.json').read_text());art.update(added);(ROOT/'artwork.json').write_text(json.dumps(art,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'reports/web-artwork-matches.json').write_text(json.dumps(added,ensure_ascii=False,indent=2)+'\n')
 print('Added exact-title original thumbnails:',len(added),flush=True)
if __name__=='__main__':main()
