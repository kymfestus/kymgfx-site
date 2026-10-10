#!/usr/bin/env python3
"""Refresh public Behance work locally; redeploy these static files afterwards."""
import argparse, datetime, email.utils, hashlib, json, re, time, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from site_tools import ROOT, FEED, PROFILE, atomic_write, save_snapshot, load_overrides, display_title

MAX_XML = 1_000_000
MAX_IMAGE = 2_000_000
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

def read(url, limit):
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(urllib.request.Request(url, headers={'User-Agent': 'KymGfxPortfolio/1.0', 'Accept': '*/*'}), timeout=30) as response:
        if int(response.headers.get('Content-Length', '0')) > limit: raise ValueError('Oversized source')
        raw = response.read(limit + 1)
        if len(raw) > limit: raise ValueError('Oversized source')
        return raw

def parse_feed(raw, now=None):
    if len(raw) > MAX_XML: raise ValueError('Oversized feed')
    text = raw.decode('utf-8', errors='strict')
    if re.search(r'<!DOCTYPE|<!ENTITY', text, re.I): raise ValueError('Unsupported RSS declarations')
    root = ET.fromstring(text); channel = root.find('channel')
    if root.tag != 'rss' or channel is None or channel.findtext('link', '').rstrip('/') not in [PROFILE, PROFILE.replace('https:', 'http:')]: raise ValueError('Unexpected portfolio owner')
    items = channel.findall('item')
    if not 1 <= len(items) <= 24: raise ValueError('Unexpected feed size')
    from urllib.parse import urlsplit
    result = []; seen = set(); now = now if now is not None else time.time()
    for item in items:
        title = re.sub(r'[\x00-\x1f\x7f]', ' ', item.findtext('title', '')).strip()
        url = item.findtext('link', '').strip()
        match = re.fullmatch(r'https://www\.behance\.net/gallery/(\d{5,12})/[A-Za-z0-9_-]+', url)
        image = re.search(r'<img\s[^>]*\bsrc=[\'"]([^\'"]+)', item.findtext('description', ''), re.I)
        stamp = email.utils.parsedate_to_datetime(item.findtext('pubDate', ''))
        if stamp.tzinfo is None: raise ValueError('Publication timezone required')
        published = int(stamp.timestamp())
        if not title or len(title) > 200 or not match or not image or not 946684800 <= published <= int(now) + 86400: raise ValueError('Invalid project metadata')
        ident = match[1]; source = image[1]; u = urlsplit(source)
        if ident in seen: raise ValueError('Duplicate project')
        seen.add(ident)
        if u.scheme != 'https' or u.netloc != 'mir-s3-cdn-cf.behance.net' or u.query or u.fragment or not re.fullmatch(r'/projects/\d{2,4}/[A-Za-z0-9._-]+\.(png|jpe?g|webp)', u.path, re.I): raise ValueError('Untrusted cover source')
        result.append({'id': ident, 'title': title, 'url': url, 'coverSource': source, 'publishedOn': published, 'publishedAt': datetime.datetime.fromtimestamp(published, datetime.timezone.utc).isoformat().replace('+00:00', 'Z')})
    return sorted(result, key=lambda p: (p['publishedOn'], int(p['id'])), reverse=True)

def raster_ext(raw):
    if len(raw) < 16 or len(raw) > MAX_IMAGE: raise ValueError('Invalid image size')
    if raw.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if raw.startswith(b'\xff\xd8\xff'): return 'jpg'
    if raw[:4] == b'RIFF' and raw[8:12] == b'WEBP': return 'webp'
    raise ValueError('Cover must be a supported raster image')

def refresh(root=ROOT, fetcher=read):
    previous = json.loads((root / 'portfolio.json').read_text(encoding='utf-8'))
    projects = parse_feed(fetcher(FEED, MAX_XML))
    # Complete all retrieval and validation before altering the saved portfolio.
    downloads = []
    for p in projects:
        raw = fetcher(p['coverSource'], MAX_IMAGE); ext = raster_ext(raw)
        p['cover'] = 'assets/behance/' + p['id'] + '-' + hashlib.sha256(raw).hexdigest()[:16] + '.' + ext
        downloads.append((root / p['cover'], raw))
    overrides = load_overrides(root)
    for p in projects: p['displayTitle'] = display_title(p, overrides)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    signature = lambda ps: [(p['id'], p['title'], p.get('displayTitle', p['title']), p['url'], p['cover'], p['publishedOn']) for p in ps]
    changed = signature(projects) != signature(previous['projects'])
    for path, raw in downloads:
        if not path.exists(): atomic_write(path, raw)
        elif path.read_bytes() != raw: raise ValueError('Cached image mismatch')
    state = {'profileUrl': PROFILE, 'checkedAt': stamp, 'updatedAt': stamp if changed else previous.get('updatedAt', stamp), 'projects': projects}
    save_snapshot(root, state)
    old_ids = {p['id'] for p in previous['projects']}
    seen = {}
    for p in projects: seen.setdefault(p['displayTitle'].casefold(), []).append(p['id'])
    duplicates = sorted(i for ids in seen.values() if len(ids) > 1 for i in ids)
    return {'warnings': ['Projects share a title; add a title to portfolio-overrides.json: ' + ', '.join(duplicates)] if duplicates else [], 'status': 'updated' if changed else 'unchanged', 'projectCount': len(projects), 'newProjects': [p['title'] for p in projects if p['id'] not in old_ids], 'checkedAt': stamp}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=ROOT, help='Folder containing index.html and portfolio.json')
    args = parser.parse_args()
    try: print(json.dumps(refresh(args.site.resolve()), ensure_ascii=False))
    except Exception as error:
        parser.exit(1, 'Refresh failed; the saved featured work is retained. ' + str(error)[:200] + '\n')
