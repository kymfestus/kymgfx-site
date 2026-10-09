#!/usr/bin/env python3
"""Check local links, media, structure, integrity, JSON-LD and portable data."""
import argparse, json, re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from pathlib import Path
from site_tools import ROOT, PAGES, digest, safe_project, stamp_pages, PROFILE

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.refs = []; self.styles_scripts = []; self.policy = None
        self.labels = []; self.h1s = 0; self.mains = 0; self.samples = 0; self.blank_links = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, 'Duplicate ID: ' + a['id']; self.ids.add(a['id'])
        assert not any(k.lower().startswith('on') for k in a), 'Inline event handler'
        assert 'style' not in a, 'Inline style attribute'
        self.h1s += tag == 'h1'; self.mains += tag == 'main'
        self.samples += 'testimonial-card' in a.get('class', '').split()
        if tag == 'label' and a.get('for'): self.labels.append(a['for'])
        if tag == 'meta' and a.get('http-equiv') == 'Content-Security-Policy': self.policy = a.get('content')
        if tag in ['a', 'link', 'script', 'img', 'source', 'video', 'use']:
            self.refs.append((tag, a.get('src') or a.get('href') or '', a))
        if tag == 'a' and a.get('target') == '_blank': self.blank_links.append(a)
        if (tag == 'script' and a.get('src')) or (tag == 'link' and a.get('rel') == 'stylesheet'):
            self.styles_scripts.append(a)

def check(root):
    parsed = {}
    for name in PAGES:
        html = (root / name).read_text(encoding='utf-8'); page = Page(); page.feed(html); parsed[name] = page
        assert page.h1s == 1 and page.mains == 1, (name, 'Page structure')
        assert page.policy and 'unsafe-inline' not in page.policy and 'unsafe-eval' not in page.policy
        for directive in ["connect-src 'self'", "object-src 'none'", "base-uri 'none'", 'form-action mailto:']:
            assert directive in page.policy, (name, directive)
        assert set(page.labels) <= page.ids, (name, 'Unbound label')
        if page.samples: assert html.count('Sample testimonial · client approval required') == page.samples
        for a in page.blank_links: assert {'noopener', 'noreferrer'} <= set(a.get('rel', '').split())
        for a in page.styles_scripts:
            url = a.get('src') or a.get('href'); target = root / Path(urlsplit(url).path).name
            assert a.get('integrity') == digest(target.read_bytes(), 'sha384'), (name, url, 'Integrity')
        for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
            json.loads(raw); assert "'" + digest(raw.encode()) + "'" in page.policy, (name, 'JSON-LD hash')
        assert not re.search(r'chatgpt\.site|OAI-Sites-Authorization|siwc_bypass', html, re.I)
    for name, page in parsed.items():
        for tag, ref, a in page.refs:
            u = urlsplit(ref)
            if u.scheme or u.netloc:
                assert u.scheme in ['https', 'mailto'], (name, 'Unsafe URL', ref)
                continue
            target_name = (u.path.lstrip('/') or 'index.html') if u.path else name
            target = root / target_name
            # A configured deployment subpath can prefix the custom 404 stylesheet/home link.
            if not target.is_file() and name == '404.html':
                target = root / (Path(u.path).name if u.path.endswith('.css') else 'index.html')
                target_name = target.name
            assert target.is_file(), (name, 'Missing local reference', ref)
            if u.fragment:
                assert target_name in parsed and u.fragment in parsed[target_name].ids, (name, 'Missing anchor', ref)
    # Resolve CSS URLs relative to the stylesheet, including the local font import.
    for path in [root / 'styles.css', root / 'assets/fonts.css']:
        text = path.read_text(encoding='utf-8')
        refs = re.findall(r'url\(\s*["\']?([^\s)"\']+)', text)
        refs += re.findall(r'@import\s+["\']([^"\']+)', text)
        for ref in refs:
            u = urlsplit(ref)
            if not u.scheme and not u.netloc: assert (path.parent / u.path).is_file(), ('CSS reference', path, ref)
    state = json.loads((root / 'portfolio.json').read_text(encoding='utf-8'))
    assert state.get('profileUrl') == PROFILE and 1 <= len(state['projects']) <= 24
    assert len({p['id'] for p in state['projects']}) == len(state['projects'])
    for project in state['projects']:
        assert safe_project(project), 'Untrusted project'
        raw = (root / project['cover']).read_bytes()
        assert 16 <= len(raw) <= 2_000_000
        assert raw.startswith((b'\x89PNG\r\n\x1a\n', b'\xff\xd8\xff')) or (raw[:4] == b'RIFF' and raw[8:12] == b'WEBP')
    front = (root / 'portfolio.js').read_text()
    assert "fetch('portfolio.json'" in front and '/api/' not in front and 'innerHTML' not in front
    assert (root / 'index.html').read_text().count('class="project-card fresh-project-card"') <= 3
    assert 'X-Content-Type-Options: nosniff' in (root / '_headers').read_text()
    if (root / 'sitemap.xml').exists():
        import xml.etree.ElementTree as ET
        locs = ET.fromstring((root / 'sitemap.xml').read_bytes()).findall('{*}url/{*}loc')
        assert len(locs) == 3 and all(x.text.startswith('https://') and 'chatgpt.site' not in x.text for x in locs)
    print(f'Checks passed: four pages, links/anchors, local assets/fonts, {len(state["projects"])} project covers, integrity, CSP/JSON-LD, labels, sample permissions and portable data.')

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--stamp', action='store_true'); args = p.parse_args()
    if args.stamp: stamp_pages()
    check(ROOT)
