#!/usr/bin/env python3
"""Import original, exact-title libretro artwork for remaining emulator entries.
Does not substitute sequels, approximate names, or generate category artwork.
"""
import concurrent.futures, hashlib, json, re, urllib.parse
from pathlib import Path
import emulator_artwork as em
ROOT=Path(__file__).resolve().parent.parent
CACHE=Path('/tmp/turbo-full-art-indexes');CACHE.mkdir(exist_ok=True)

def index(system):
 repo=em.SYSTEMS[system];p=CACHE/(repo+'.json')
 if not p.exists():p.write_bytes(em.fetch(f'https://api.github.com/repos/libretro-thumbnails/{repo}/git/trees/master?recursive=1'))
 data=json.loads(p.read_text())
 if data.get('truncated'):raise ValueError('Truncated index: '+repo)
 return [r['path'] for r in data['tree'] if r['path'].startswith(('Named_Boxarts/','Named_Titles/','Named_Snaps/')) and r['path'].endswith('.png')]

def choose(names,paths,system):
 # Standard matching first. Arcade filenames often append an alternate Japanese
 # name or descriptive subtitle after separators, with region/revision in ().
 match=em.select(names,paths)
 if match and not re.match(r'^\d+\s+in\s+\d+$',names[0],re.I):return match
 if system!='arcade':return None
 target=em.normalize(names[0])
 matches=[p for p in paths if target and target==em.normalize(re.split(r' _ | - ',Path(p).stem)[0])]
 return sorted(matches,key=lambda p:('Named_Boxarts/' not in p,'Named_Titles/' not in p,'Japan' in p,p))[0] if matches else None

def main():
 catalog=json.loads((ROOT/'catalog.js').read_text().split('=',1)[1].strip().rstrip(';'))
 artwork=json.loads((ROOT/'artwork.json').read_text());pending=[i for i in catalog if i['category']=='emulator' and artwork[i['id']]['type']=='illustrated']
 prepared=[(i,*em.candidates(i)) for i in pending];systems=sorted({s for _,s,_ in prepared if s})
 indexes={}
 def get(s):
  try:return s,index(s)
  except Exception as e:print('Index unavailable',s,str(e),flush=True);return s,[]
 with concurrent.futures.ThreadPoolExecutor(6) as pool:
  for s,paths in pool.map(get,systems):indexes[s]=paths
 jobs=[(i,s,p) for i,s,n in prepared if (p:=choose(n,indexes.get(s,[]),s))]
 print('Exact title matches',len(jobs),flush=True)
 dest=ROOT/'assets/covers/original';dest.mkdir(parents=True,exist_ok=True)
 def download(job):
  i,s,path=job;url='https://raw.githubusercontent.com/libretro-thumbnails/'+em.SYSTEMS[s]+'/master/'+urllib.parse.quote(path,safe='/')
  try:
   for _ in range(6):
    data=em.fetch(url)
    if data.startswith(b'\x89PNG\r\n\x1a\n'):break
    if len(data)>1024:raise ValueError('Not an image')
    target=data.decode().strip()
    if not re.match(r'^(?:\.\./)?Named_(?:Boxarts|Titles|Snaps)/.+\.png$',target):raise ValueError('Unknown thumbnail link')
    url=urllib.parse.urljoin(url,urllib.parse.quote(target,safe='/'))
   if not data.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('No PNG resolved')
   local=dest/(hashlib.sha256(data).hexdigest()[:24]+'.png');local.write_bytes(data)
   return i['id'],{'image':local.relative_to(ROOT).as_posix(),'type':'source-artwork','source':url,'attribution':'Exact game artwork from libretro-thumbnails; rights remain with respective creators.','matchedTitle':Path(path).stem}
  except Exception as e:print('Unavailable',i['title'],str(e),flush=True)
 added={}
 with concurrent.futures.ThreadPoolExecutor(10) as pool:
  for result in pool.map(download,jobs):
   if result:added[result[0]]=result[1]
 artwork.update(added);(ROOT/'artwork.json').write_text(json.dumps(artwork,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'reports/new-artwork-matches.json').write_text(json.dumps(added,ensure_ascii=False,indent=2)+'\n')
 print('Added original game images:',len(added),flush=True)
if __name__=='__main__':main()
