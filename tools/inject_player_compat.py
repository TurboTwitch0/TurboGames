#!/usr/bin/env python3
"""Install the synchronous storage compatibility bootstrap in local launchers."""
import json,re,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
catalog=ROOT/'catalog.js';raw=catalog.read_text(encoding='utf8');items=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
updated=0
for item in items:
 if '--original-only' in sys.argv and item['source'].startswith('library-source/'):continue
 source=ROOT/item['source']
 if not source.is_file():continue
 with source.open('rb') as f:head=f.read(65536)
 if b'data-turbogames-compat' in head:continue
 relative='../' * (len(Path(item['source']).parts)-1)+'player-compat.js'
 script=('\n<script src="'+relative+'" data-turbogames-compat></script>\n').encode()
 # Preserve standards mode when a normal leading doctype exists.
 match=re.match(rb'\xef\xbb\xbf?\s*<!doctype[^>]*>',head,re.I) or re.match(rb'\s*(?:<!--.*?-->\s*)*<!doctype[^>]*>',head,re.I|re.S)
 point=match.end() if match else 0
 head=head[:point]+script+head[point:]
 head=head.replace(b'window.parent.maeExportApis_();',b'try { window.parent.maeExportApis_?.(); } catch (e) {}')
 temporary=source.with_name(source.name+'.compat-tmp')
 with source.open('rb') as f, temporary.open('wb') as out:
  f.seek(65536);out.write(head);shutil.copyfileobj(f,out,1024*1024)
 temporary.replace(source);updated+=1
print('Compatibility bootstraps installed:',updated)
