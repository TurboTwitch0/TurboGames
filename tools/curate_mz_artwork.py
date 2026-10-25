"""Import exact-title, recognizable original covers for the M-Z repair batch."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from html.parser import HTMLParser
import io, json, re, sys, unicodedata, urllib.request
from pathlib import Path
from PIL import Image, ImageStat
sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_artwork as legacy

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/covers/curated/html5-mz'
OUT.mkdir(parents=True,exist_ok=True)
REPORT=ROOT/'reports/cover-replacements-html5-mz.json'
ALIASES={
 'MotoX3m Spooky Land':['Moto X3M Spooky Land'],
 'Super Mario 64 (webgl)':['Super Mario 64'],
 'Marbleracer':['Marble Racer'],
 'Oneshot (old)':['OneShot'],
 'Ragollhit':['Ragdoll Hit'],
 'Slendy Tubbies':['Slendytubbies'],
 'Pixelspeedrun':['Pixel Speedrun'],
 'Tag (coolmathgames)':['Tag'],
 'Smashhitripoff':['Smash Hit Ripoff'],
 'Snowboardobby':['Snowboard Obby'],
 'Sonicandfallingstar':['Sonic and the Falling Star'],
 'Sm64coopdx':['Super Mario 64'],
}
MANUAL_SLUG={
 'MotoX3m Spooky Land':['moto-x3m-spooky-land'],
 'Pixelspeedrun':['pixel-speedrun'],
 'Madalin Stunt Cars Multiplayer':['madalin-stunt-cars-multiplayer'],
 'Mini Crossword':['mini-crossword'],
 'Meowio':['meow-io'],
 'Ragollhit':['ragdoll-hit'],
 'Minecraft Case Sim':['minecraft-case-simulator'],
 'Rocket League':['rocket-league'],
}
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 TurboGames artwork source repair'})
 with urllib.request.urlopen(req,timeout=9) as response:
  return response.read(3000000),response.url
class Meta(HTMLParser):
 def __init__(self):super().__init__();self.values={}
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='meta':
   key=attrs.get('property',attrs.get('name','')).lower()
   if key.startswith(('og:','twitter:')):self.values[key]=attrs.get('content','')
def clean_title(value):
 return legacy.normalized(re.split(r'\s*[|–]\s*|\s+-\s+(?:Play|Free|Online)',value,flags=re.I)[0])
def slugs(item):
 values=[]
 for name in [item['title'],*ALIASES.get(item['title'],[])]:
  value=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower().replace("'",'').replace('&','and')
  slug=re.sub('[^a-z0-9]+','-',value).strip('-')
  values.append(slug)
  fixed=re.sub(r'([a-z])(\d)|(\d)([a-z])',lambda m:(m[1]+'-'+m[2]) if m[1] else (m[3]+'-'+m[4]),slug)
  if fixed!=slug:values.append(fixed)
 return list(dict.fromkeys(MANUAL_SLUG.get(item['title'],[])+values))
def save_image(item,url,credit,page=None,matched=None):
 data,actual=fetch(url.replace(' ','%20'))
 if sha256(data).hexdigest() in legacy.GENERIC_IMAGE_HASHES:raise ValueError('generic engine icon')
 image=Image.open(io.BytesIO(data));image.seek(0);image=image.convert('RGB')
 if min(image.size)<64 or max(image.size)<100:raise ValueError('small icon')
 if max(ImageStat.Stat(image.resize((32,32))).stddev)<12:raise ValueError('blank or low detail')
 image.thumbnail((700,700),Image.Resampling.LANCZOS)
 filename=re.sub('[^a-z0-9]+','-',item['title'].lower()).strip('-')[:70]+'-'+sha256(data).hexdigest()[:10]+'.webp'
 dest=OUT/filename;image.save(dest,'WEBP',quality=91,method=5)
 entry={'image':dest.relative_to(ROOT).as_posix(),'type':'source-artwork','source':actual,'attribution':credit,'matchedTitle':matched or item['title'],'quality':'verified-cover'}
 if page:entry['sourcePage']=page
 return entry
def process(item,mapping,folders):
 # Prefer game catalog/source metadata over page scraping.
 keys={legacy.normalized(item['title']),*(legacy.normalized(n) for n in ALIASES.get(item['title'],[]))}
 candidates=legacy.candidates(item,mapping,folders)
 for key in keys:
  candidates.extend(mapping.get(key,[]))
 for score,url,credit,kind in sorted(candidates,reverse=True):
  try:
   entry=save_image(item,url,credit)
   return item['id'],entry
  except Exception:pass
 for slug in slugs(item):
  for prefix,label in [('https://www.miniplay.com/game/','Miniplay'),('https://www.crazygames.com/game/','CrazyGames'),('https://poki.com/en/g/','Poki')]:
   page=prefix+slug
   try:
    data,actual=fetch(page);meta=Meta();meta.feed(data.decode(errors='replace'));v=meta.values
    title=v.get('og:title',v.get('twitter:title',''))
    if clean_title(title) not in keys:continue
    url=v.get('og:image',v.get('twitter:image',''))
    if not url.startswith('https://'):continue
    entry=save_image(item,url,'Original artwork from the exact-title '+label+' game page; rights remain with the game creator.',actual,title)
    return item['id'],entry
   except Exception:pass
 return None
def main():
 art=json.loads((ROOT/'artwork.json').read_text())
 items=json.loads((ROOT/'catalog.js').read_text().split('=',1)[1].strip().rstrip(';'))
 jobs=[i for i in items if i['category']=='games' and 'm'<=re.sub('[^a-z0-9]','',i['title'].lower())[:1]<='z' and i['id']!='orbit-breaker' and (art[i['id']].get('captureType') or art[i['id']]['type']=='illustrated')]
 mapping,folders=legacy.load_upstream_indexes();added=json.loads(REPORT.read_text()) if REPORT.exists() else {}
 jobs=[i for i in jobs if i['id'] not in added]
 print('Starting',len(jobs),'M-Z cover repairs',flush=True)
 with ThreadPoolExecutor(12) as pool:
  futures=[pool.submit(process,i,mapping,folders) for i in jobs]
  for n,future in enumerate(as_completed(futures),1):
   result=future.result()
   if result:added[result[0]]=result[1];print('Matched',result[1]['matchedTitle'],flush=True)
   if n%20==0:
    REPORT.write_text(json.dumps(added,indent=2,ensure_ascii=False)+'\n')
    print('Processed',n,'/',len(jobs),'matched',len(added),flush=True)
 REPORT.write_text(json.dumps(added,indent=2,ensure_ascii=False)+'\n')
 print('Finished',len(added),flush=True)
if __name__=='__main__':main()
