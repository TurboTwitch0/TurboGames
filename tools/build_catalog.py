#!/usr/bin/env python3
"""Merge local artwork into the catalog and omit non-game source templates."""
import json
import hashlib
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'catalog.js';raw=path.read_text(encoding='utf8');items=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
art=json.loads((ROOT/'artwork.json').read_text(encoding='utf8'))
previews=json.loads((ROOT/'cover-thumbnails.json').read_text()) if (ROOT/'cover-thumbnails.json').exists() else {}
removed=[x for x in items if '/000_Templates/' in x['source']]
items=[x for x in items if '/000_Templates/' not in x['source']]
missing=[]
for item in items:
 cover=art.get(item['id']) or art.get(item['source'])
 if not cover or not (ROOT/cover['image']).is_file():missing.append(item['id']);continue
 original=ROOT/cover['image'];preview=previews.get(cover['image'])
 valid_preview=preview and (ROOT/preview['image']).is_file() and hashlib.sha256(original.read_bytes()).hexdigest()==preview.get('source_sha256')
 item['image']=preview['image'] if valid_preview else cover['image'];item['imageType']=cover.get('type','source-artwork')
 if cover.get('fit')=='contain':item['imageFit']='contain'
 else:item.pop('imageFit',None)
 source=ROOT/item['source'];size=source.stat().st_size
 if size>2*1024*1024:
  item['sourceBytes']=size
  with source.open('rb') as file:prepared=b'data-turbogames-direct' in file.read(8192)
  if prepared:item['directLaunch']=True
  else:item.pop('directLaunch',None)
 else:
  item.pop('sourceBytes',None);item.pop('directLaunch',None)
if missing:raise SystemExit('Missing image coverage: '+str(missing[:10]))
# Derive genre hints once at build time instead of repeating every title regex
# during startup on a phone. Explicit hand-authored genres stay authoritative.
node="const m=require('./game-categories.js');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s).map(x=>m.genresFor(x)))));"
hints=json.loads(subprocess.check_output(['node','-e',node],input=json.dumps(items).encode(),cwd=ROOT))
for item,genres in zip(items,hints):item['genreHints']=genres
path.write_text('window.TURBO_CATALOG = '+json.dumps(items,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
previous_report=ROOT/'reports/catalog-build.json'
previous_omitted=json.loads(previous_report.read_text()).get('omitted_templates',[]) if previous_report.exists() else []
report={'items':len(items),'source_artwork':sum(x['imageType']=='source-artwork' for x in items),'illustrated_covers':sum(x['imageType']!='source-artwork' for x in items),'omitted_templates':sorted(set(previous_omitted+[x['source'] for x in removed]))}
(ROOT/'reports').mkdir(exist_ok=True);(ROOT/'reports/catalog-build.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='omitted_templates'}))
