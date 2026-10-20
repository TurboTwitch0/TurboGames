#!/usr/bin/env python3
"""Static launcher audit. No downloaded game scripts are executed.

Reports missing local resource references, source error pages, placeholders, and
remote dependencies. An HTTP response or structural pass does not establish that
a game can be played; use browser smoke checks separately.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote

RESOURCE_ATTRS = {'script':'src','iframe':'src','embed':'src','object':'data','img':'src','audio':'src','video':'src','source':'src','track':'src','link':'href'}
OPTIONAL_REL = {'icon','shortcut','apple-touch-icon','manifest','preconnect','dns-prefetch','canonical','alternate'}
class Resources(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.resources=[]; self.base=None; self.tags=Counter()
    def handle_starttag(self,tag,attributes):
        self.tags[tag]+=1; attrs=dict(attributes)
        if tag=='base' and attrs.get('href') and self.base is None: self.base=attrs['href']
        attr=RESOURCE_ATTRS.get(tag)
        if attr and attrs.get(attr):
            rel=set(attrs.get('rel','').lower().split())
            optional=tag in {'img','track','audio'} or (tag=='link' and bool(rel & OPTIONAL_REL))
            if tag=='link' and not (rel & {'stylesheet','modulepreload','preload'}): optional=True
            self.resources.append({'tag':tag,'attribute':attr,'url':attrs[attr],'optional':optional})
        if tag=='meta' and attrs.get('http-equiv','').lower()=='refresh':
            self.resources.append({'tag':'meta-refresh','attribute':'content','url':attrs.get('content',''),'optional':False})
    handle_startendtag=handle_starttag

def audit(root):
    all_files=sorted((root/'library-source').rglob('*'))
    files=[p for p in all_files if p.is_file() and p.suffix.lower() in {'.html','.htm'}]
    records=[]; remote=Counter(); summary=Counter()
    for p in files:
        rel=p.relative_to(root).as_posix()
        parser=Resources(); issues=[]
        with p.open('r',encoding='utf-8',errors='replace') as f:
            head=f.read(16384); sample=head.lower()
            if not head.strip(): issues.append({'kind':'empty'})
            if '/000_Templates/' in rel or 'YourGithubName' in head: issues.append({'kind':'source-template'})
            if p.stat().st_size < 500000:
                rest=f.read()
                # Small source wrappers may leave a regex replacement token in JavaScript.
                source=head+rest
                if re.search(r'''player\.load\(\s*['"]\$1['"]''',source): issues.append({'kind':'unresolved-flash-placeholder'})
                f.seek(0); head=f.read(16384)
            if 'this launcher could not be copied from google drive' in sample: issues.append({'kind':'placeholder'})
            if 'virus scan warning' in sample or 'id="download-form"' in sample or "can't scan this file for viruses" in sample: issues.append({'kind':'drive-warning'})
            if any(x in sample for x in ['google drive - access denied','google drive - quota exceeded','sorry, the file you have requested does not exist']): issues.append({'kind':'source-error-page'})
            try:
                parser.feed(head)
                while chunk:=f.read(1048576): parser.feed(chunk)
                parser.close()
            except Exception as e: issues.append({'kind':'parse-error','detail':str(e)})
        required_missing=[]; optional_missing=[]; external=[]
        document='https://turbogames.local/'+rel
        base=urljoin(document,parser.base) if parser.base else document
        for item in parser.resources:
            raw=item['url'].strip()
            if raw.startswith(('data:','blob:','javascript:','#','about:')):continue
            if item['tag']=='meta-refresh':
                issues.append({'kind':'redirect','value':raw});continue
            try:u=urlsplit(urljoin(base,raw))
            except ValueError:
                issues.append({'kind':'invalid-resource-url','value':raw});continue
            if u.scheme not in {'http','https'}:
                if u.scheme:issues.append({'kind':'unsupported-resource-scheme','value':raw})
                continue
            if u.hostname and any(c.isspace() for c in u.hostname):
                issues.append({'kind':'invalid-resource-host','value':raw})
            if u.hostname!='turbogames.local':
                remote[u.hostname]+=1;external.append(item)
            elif not (root/unquote(u.path).lstrip('/')).is_file():
                (optional_missing if item['optional'] else required_missing).append(item)
        if required_missing:issues.append({'kind':'missing-local-resource','resources':required_missing})
        if optional_missing:issues.append({'kind':'missing-optional-local-resource','resources':optional_missing})
        record={'path':rel,'bytes':p.stat().st_size,'issues':issues,'external_resource_count':len(external)}
        if external: record['external_resources']=external
        if issues:
            for kind in {i['kind'] for i in issues}:summary[kind]+=1
        else:summary['structural-pass']+=1
        records.append(record)
    return {'generated_at':datetime.now(timezone.utc).isoformat(),'method':'Static HTML scan of every imported launcher; remote runtime dependencies and game play not verified.','file_count':len(files),'total_bytes':sum(p.stat().st_size for p in files),'summary':dict(summary),'external_hosts':dict(remote.most_common()),'launchers':records}

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);ap.add_argument('--output',type=Path);args=ap.parse_args()
    report=audit(args.root.resolve());output=args.output or args.root/'reports/launcher-audit.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
    md=['# Launcher static audit','',report['method'],'',f"Imported launcher files: **{report['file_count']:,}**.",'','| Result | Files |','| --- | ---: |']+[f'| {k} | {v:,} |' for k,v in report['summary'].items()]
    md+=['','A structural pass means the file is nonempty, does not contain recognized source error pages, and has no missing literal local resources. It does not confirm network availability, emulator compatibility, startup, or playability.','', 'Full resource paths and external dependencies are in `launcher-audit.json`.']
    output.with_suffix('.md').write_text('\n'.join(md)+'\n');print(json.dumps({k:report[k] for k in ['file_count','total_bytes','summary','external_hosts']},indent=2))
if __name__=='__main__':main()
