"""Scoped cover repair: exact storefront/creator metadata, never loading screenshots."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib, html, io, json, re, sys, unicodedata, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageStat

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/turbo-curation-html5-al');CACHE.mkdir(exist_ok=True)
DEST=ROOT/'assets/covers/curated/html5-al';DEST.mkdir(parents=True,exist_ok=True)
REPORT=ROOT/'reports/cover-replacements-html5-al.json'
USER_AGENT='Mozilla/5.0 (compatible; TurboGames artwork verification)'

def fetch(url,timeout=14,limit=6000000):
    path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
    if path.exists():return path.read_bytes()
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':USER_AGENT}),timeout=timeout) as response:
        data=response.read(limit+1)
    if len(data)>limit:raise ValueError('oversize')
    path.write_bytes(data);return data

def norm(value):
    value=unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().lower().replace('&','and')
    value=re.sub(r"\bfriday[\s-]+night[\s-]+funkin[g']?|\bfnf\b",'',value)
    value=re.sub(r'\bvs\.?\s*','',value)
    value=re.sub(r'\((?:jam version|demo|web version|1)\)','',value)
    value=re.sub(r'[-|:].*?(?:play online|free online|poki|crazygames|kbhgames|fnfgo).*$', '',value)
    return re.sub('[^a-z0-9]','',value)

ALIASES={
    'Arthursnightmare (1)':"Arthur's Nightmare",
    'Badmondaysimulator (1)':'Bad Monday Simulator',
    'Carkingarena (1)':'Car King Arena',
    'Bad Piggies (LATEST)':'Bad Piggies',
    'FNAF':"Five Nights at Freddy's",
    'FNAF 2':"Five Nights at Freddy's 2",
    'FNAF 3':"Five Nights at Freddy's 3",
    'FNAF 4':"Five Nights at Freddy's 4",
    'FNAF Sister Location':"Five Nights at Freddy's: Sister Location",
    'FNAF Ultimate Custom Night':'Ultimate Custom Night',
    'FNAF Pizzeria Simulator':"Freddy Fazbear's Pizzeria Simulator",
    'Bit Burner':'Bitburner',
    'Grand Theft Auto III':'Grand Theft Auto III',
    'BAS':'BAS',
    'Laceysflashgames (1)':"Lacey's Flash Games",
    'Effing Hail':'Effing Hail',
    'Dreader':'Dreader',
    'FNAF 4 Halloween':"Five Nights at Freddy's 4 Halloween",
}

class Meta(HTMLParser):
    def __init__(self):super().__init__();self.values={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='meta':self.values[a.get('property',a.get('name',''))]=a.get('content','')
        elif tag=='link' and a.get('rel')=='canonical':self.values['canonical']=a.get('href','')

class ItchCells(HTMLParser):
    def __init__(self):super().__init__();self.cells=[];self.current=None;self.depth=0;self.title=False
    def handle_starttag(self,t,attrs):
        a=dict(attrs);classes=a.get('class','').split()
        if t=='div' and 'game_cell' in classes:
            self.current={};self.depth=1
        elif self.current is not None and t=='div':self.depth+=1
        if self.current is None:return
        if t=='img' and not self.current.get('image'):self.current['image']=a.get('data-lazy_src') or a.get('src')
        if t=='a' and 'title' in classes and 'game_link' in classes:
            self.title=True;self.current['page']=a.get('href')
    def handle_endtag(self,t):
        if self.current is None:return
        if t=='a':self.title=False
        if t=='div':
            self.depth-=1
            if self.depth==0:self.cells.append(self.current);self.current=None
    def handle_data(self,data):
        if self.current is not None and self.title:self.current['title']=self.current.get('title','')+data

def candidate_pages(title):
    basic=title.lower().replace("'",'').replace('’','').replace('&','and')
    basic=re.sub(r'\s*\(1\)$','',basic)
    slug=re.sub('[^a-z0-9]+','-',basic).strip('-')
    variants=list(dict.fromkeys([slug,re.sub(r'([a-z])([0-9])',r'\1-\2',slug)]))
    for variant in variants:
        if len(variant)<4:continue
        yield 'https://www.miniplay.com/game/'+variant,'Miniplay'
        yield 'https://www.crazygames.com/game/'+variant,'CrazyGames'
        yield 'https://poki.com/en/g/'+variant,'Poki'
    if 'fnf' in basic or 'friday night funkin' in basic:
        short=re.sub(r'^friday-night-funkin-?','fnf-',slug)
        yield 'https://www.fnfgo.com/'+short+'.html','FNF Go'
        yield 'https://kbhgames.com/game/'+short,'KBH Games'

def storefront_candidates(item):
    title=ALIASES.get(item['title'],item['title']);target=norm(title)
    found=[]
    if len(target)<4:return found
    for page,site in candidate_pages(title):
        try:
            meta=Meta();meta.feed(fetch(page,timeout=9,limit=2000000).decode(errors='replace'));v=meta.values
            actual=v.get('og:title','')
            if norm(actual)!=target:continue
            canonical=v.get('og:url') or v.get('canonical') or page
            if urllib.parse.urlparse(canonical).path.rstrip('/')!=urllib.parse.urlparse(page).path.rstrip('/'):continue
            image=v.get('og:image') or v.get('twitter:image')
            if image and image.startswith('https://'):found.append((image,page,actual,site));break
        except Exception:pass
    return found

def itch_candidates(item):
    title=ALIASES.get(item['title'],item['title']);target=norm(title)
    if len(target)<4:return []
    try:
        page='https://itch.io/search?q='+urllib.parse.quote(title)
        parser=ItchCells();parser.feed(fetch(page,timeout=10,limit=3000000).decode(errors='replace'))
        result=[]
        for cell in parser.cells:
            if norm(cell.get('title',''))==target and cell.get('image','').startswith('https://'):
                result.append((cell['image'],cell['page'],cell['title'],'itch.io creator game page'))
        return result
    except Exception:return []

def steam_candidates(item):
    title=ALIASES.get(item['title'],item['title']);target=norm(title)
    if len(target)<4 or 'fnf' in item['title'].lower() or 'friday night funkin' in item['title'].lower():return []
    try:
        url='https://store.steampowered.com/api/storesearch/?term='+urllib.parse.quote(title)+'&l=english&cc=US'
        values=json.loads(fetch(url,timeout=10))
        return [('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/'+str(game['id'])+'/header.jpg','https://store.steampowered.com/app/'+str(game['id'])+'/',game['name'],'Steam store')
                for game in values.get('items',[]) if norm(game['name'])==target]
    except Exception:return []

def save_image(item,candidates):
    for url,page,title,site in candidates:
        try:
            data=fetch(url,timeout=12)
            image=Image.open(io.BytesIO(data));image.seek(0);image=image.convert('RGB')
            if image.width<140 or image.height<90:continue
            tiny=image.resize((32,32));stat=ImageStat.Stat(tiny)
            if sum(stat.stddev)<20:continue
            background=ImageOps.fit(image,(512,512)).filter(ImageFilter.GaussianBlur(15))
            foreground=ImageOps.contain(image,(512,512))
            background.paste(foreground,((512-foreground.width)//2,(512-foreground.height)//2))
            name=hashlib.sha256((item['id']+url).encode()).hexdigest()[:20]+'.webp'
            local=DEST/name;background.save(local,'WEBP',quality=91)
            return {'image':local.relative_to(ROOT).as_posix(),'type':'source-artwork','source':url,'sourcePage':page,'matchedTitle':title,'quality':'verified-cover','attribution':'Game cover artwork from its title-matched '+site+' metadata page; rights remain with the game creators.'}
        except Exception:continue

def main():
    art=json.loads((ROOT/'artwork.json').read_text())
    jobs=json.loads(Path('/tmp/html5-al-items.json').read_text())
    jobs=[i for i in jobs if i['title'] not in ('Little Match','Backrooms 3D Multiplayer')]
    added=json.loads(REPORT.read_text()) if REPORT.exists() else {}
    phase=sys.argv[1] if len(sys.argv)>1 else 'itch'
    pending=[i for i in jobs if i['id'] not in added]
    method={'itch':itch_candidates,'steam':steam_candidates,'web':storefront_candidates}[phase]
    def work(i):
        r=save_image(i,method(i))
        return i,r
    with ThreadPoolExecutor(max_workers=12) as pool:
        for count,f in enumerate(as_completed([pool.submit(work,i) for i in pending]),1):
            item,result=f.result()
            if result:added[item['id']]=result;print('ADDED',item['title'],'->',result['matchedTitle'],flush=True)
            if count%25==0:REPORT.write_text(json.dumps(added,indent=2,ensure_ascii=False)+'\n');print('PROGRESS',phase,count,'/',len(pending),'matched',len(added),flush=True)
    REPORT.write_text(json.dumps(added,indent=2,ensure_ascii=False)+'\n')
    print('DONE',phase,'matches',len(added))

if __name__=='__main__':main()
