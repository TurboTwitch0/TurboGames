#!/usr/bin/env python3
"""Recheck launchers using the removed schoolstuff1337/supplies asset host."""
import concurrent.futures,json,re,urllib.request,urllib.parse
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
multipart={x['source']:x for x in json.load(open(ROOT/'reports/emulator-multipart-audit.json'))['results']}
entries=[]
for p in (ROOT/'library-source/emulated').rglob('*.html'):
 s=p.read_text(errors='replace')
 if 'schoolstuff1337/supplies' not in s:continue
 rel=p.relative_to(ROOT).as_posix();m=multipart.get(rel)
 urls=[c['url'] for c in m.get('boundary_checks',[])] if m else re.findall(r'https?://[^\s"\x27<>`]*schoolstuff1337/supplies[^\s"\x27<>`]+',s)
 for u in set(urls):entries.append((rel,u))
def check(pair):
 rel,u=pair;parts=urllib.parse.urlsplit(u);u=urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path,safe='/%:@()+,')))
 try:
  req=urllib.request.Request(u,headers={'User-Agent':'TurboGames-source-check','Range':'bytes=0-511'})
  with urllib.request.urlopen(req,timeout=12) as r:r.read(512);return {'source':rel,'url':u,'status':r.status}
 except urllib.error.HTTPError as e:return {'source':rel,'url':u,'status':e.code}
 except Exception as e:return {'source':rel,'url':u,'error':str(e)}
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(check,entries))
by={}
for x in results:by.setdefault(x['source'],[]).append(x)
missing=[p for p,checks in by.items() if any(x.get('status') in (404,410) for x in checks)]
report={'checked_at':datetime.now(timezone.utc).isoformat(),'method':'GET range checks of actual game assets/first-last parts for removed host; matching replacement not verified. No unrelated games substituted.','launchers_unavailable':missing,'results':results}
(ROOT/'reports/unavailable-game-sources.json').write_text(json.dumps(report,indent=2))
path=ROOT/'catalog.js';raw=path.read_text();items=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
for item in items:
 if item['source'] in missing:item['sourceStatus']='unavailable'
path.write_text('window.TURBO_CATALOG = '+json.dumps(items,ensure_ascii=False,separators=(',',':'))+';\n')
print('Known unavailable game sources',len(missing),'checks',len(results))
