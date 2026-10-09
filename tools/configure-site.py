#!/usr/bin/env python3
"""Set canonical metadata for an HTTPS origin, optionally including a subpath."""
import argparse, json, re
from urllib.parse import urlsplit
from xml.sax.saxutils import escape
from site_tools import ROOT, PAGES, atomic_write, stamp_pages

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True, help='Final HTTPS site URL, e.g. https://kymgfx.com or https://you.github.io/portfolio')
parser.add_argument('--clean-urls', action='store_true', help='Use /book and /testimonials in SEO URLs for hosts that strip .html')
args = parser.parse_args()
url = args.url.rstrip('/')
try:
    u = urlsplit(url)
    valid = (u.scheme == 'https' and u.hostname and re.fullmatch(r'[A-Za-z0-9.-]+', u.hostname)
             and not u.username and not u.password and not u.port and not u.query and not u.fragment
             and re.fullmatch(r'(?:/[A-Za-z0-9_-]+)*', u.path))
except ValueError: valid = False
if not valid: parser.error('Use an HTTPS site URL without credentials, port, query, fragment or unsafe path characters')

def structured(node, page_url):
    if isinstance(node, list): return [structured(x, page_url) for x in node]
    if not isinstance(node, dict): return node
    result = {k: structured(v, page_url) for k, v in node.items()}
    if '@id' in result and '#' in result['@id']: result['@id'] = url + '/#' + result['@id'].split('#')[-1]
    kind = result.get('@type')
    if kind in ['Organization', 'WebSite']: result['url'] = url + '/'
    if kind == 'Person': result.update(url=url + '/#about', image=url + '/assets/festus-kimani.png')
    if kind == 'WebPage': result['url'] = page_url
    return result

for name in PAGES:
    path = ROOT / name; html = path.read_text(encoding='utf-8')
    html = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>|<meta\b[^>]*property="og:url"[^>]*>', '', html)
    page_url = url + ('/' if name == 'index.html' else '/' + (name.removesuffix('.html') if args.clean_urls else name))
    if name != '404.html':
        html = html.replace('</head>', f'<link rel="canonical" href="{page_url}"><meta property="og:url" content="{page_url}">\n</head>')
    html = re.sub(r'<meta property="og:image"[^>]*>', lambda _: f'<meta property="og:image" content="{url}/assets/lisa-identity.webp">', html)
    html = re.sub(r'<script type="application/ld\+json">(.*?)</script>',
                  lambda m: '<script type="application/ld+json">' + json.dumps(structured(json.loads(m[1]), page_url), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>', html, flags=re.S)
    if name == '404.html':
        html = re.sub(r'href="[^"]*styles\.css[^\"]*"', lambda _: f'href="{u.path}/styles.css"', html)
        html = re.sub(r'href="(?:/|index\.html)"', lambda _: f'href="{u.path}/"', html)
    atomic_write(path, html)
pages = [url + '/', url + ('/book' if args.clean_urls else '/book.html'), url + ('/testimonials' if args.clean_urls else '/testimonials.html')]
atomic_write(ROOT / 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>' + escape(p) + '</loc></url>' for p in pages) + '</urlset>\n')
atomic_write(ROOT / 'robots.txt', 'User-agent: *\nAllow: /\nDisallow: ' + u.path + '/tools/\nDisallow: ' + u.path + '/deployment/\nSitemap: ' + url + '/sitemap.xml\n')
atomic_write(ROOT / 'deployment/site-settings.json', json.dumps({'siteUrl': url, 'cleanUrls': args.clean_urls, 'email': 'kymfestus@gmail.com', 'behanceProfile': 'https://www.behance.net/kymgfx0'}, indent=2) + '\n')
stamp_pages()
print('Canonical URLs, structured data, sharing image, sitemap and security hashes configured for ' + url)
