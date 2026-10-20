#!/usr/bin/env python3
"""Merge local artwork into the catalog and omit non-game source templates."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'catalog.js';raw=path.read_text(encoding='utf8');items=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
art=json.loads((ROOT/'artwork.json').read_text(encoding='utf8'))
removed=[x for x in items if '/000_Templates/' in x['source']]
items=[x for x in items if '/000_Templates/' not in x['source']]
missing=[]
for item in items:
 cover=art.get(item['id']) or art.get(item['source'])
 if not cover or not (ROOT/cover['image']).is_file():missing.append(item['id']);continue
 item['image']=cover['image'];item['imageType']=cover.get('type','source-artwork')
if missing:raise SystemExit('Missing image coverage: '+str(missing[:10]))
path.write_text('window.TURBO_CATALOG = '+json.dumps(items,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
report={'items':len(items),'source_artwork':sum(x['imageType']=='source-artwork' for x in items),'illustrated_covers':sum(x['imageType']!='source-artwork' for x in items),'omitted_templates':[x['source'] for x in removed]}
(ROOT/'reports').mkdir(exist_ok=True);(ROOT/'reports/catalog-build.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='omitted_templates'}))
