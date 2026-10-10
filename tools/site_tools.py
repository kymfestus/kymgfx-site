"""Portable site maintenance. Python 3.10+, standard library only."""
from pathlib import Path
from urllib.parse import urlsplit
from html import escape
import base64, hashlib, json, os, re, tempfile

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('index.html', 'book.html', 'onboarding.html', '404.html')
FILES = (*PAGES, 'styles.css', 'app.js', 'forms.js', 'hover.js', 'motion.js',
         'navigation.js', 'portfolio.js', 'tally.js', 'portfolio.json', 'portfolio-overrides.json', 'favicon.svg',
         '_headers', 'robots.txt', 'sitemap.xml', '.nojekyll', 'netlify.toml', 'vercel.json')
START = '<!-- KYM FEATURED START -->'
END = '<!-- KYM FEATURED END -->'
PROFILE = 'https://www.behance.net/kymgfx0'
FEED = 'https://www.behance.net/feeds/user?username=kymgfx0'
LINK = re.compile(r'https://www\.behance\.net/gallery/(\d{5,12})/[A-Za-z0-9_-]+')
LOCAL_COVER = re.compile(r'assets/behance/(\d{5,12})-[a-f0-9]{16}\.(png|jpg|webp)')

def atomic_write(path, raw):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(raw, str): raw = raw.encode('utf-8')
    name = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
            name = f.name; f.write(raw); f.flush(); os.fsync(f.fileno()); os.fchmod(f.fileno(), 0o644)
        os.replace(name, path)
    finally:
        if name and Path(name).exists(): Path(name).unlink()

def digest(raw, kind='sha256'):
    return kind + '-' + base64.b64encode(hashlib.new(kind, raw).digest()).decode()


ACRONYMS = {'AI': 'AI', 'UI': 'UI', 'UX': 'UX', '3D': '3D', 'DJ': 'DJ', 'TV': 'TV', 'GTI': 'GTI', 'SAAS': 'SaaS', 'VS': 'vs'}
SMALL = {'a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to'}

def load_overrides(root=ROOT):
    path = Path(root) / 'portfolio-overrides.json'
    if not path.is_file(): return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    return {k: v for k, v in data.items() if isinstance(v, dict) and re.fullmatch(r'\d{5,12}', k)}

def display_title(project, overrides=None):
    """Readable title: an explicit override wins; all-caps Behance titles become Title Case."""
    title = (overrides or {}).get(project['id'], {}).get('title') or project['title']
    title = re.sub(r'[\x00-\x1f\x7f]', ' ', title).strip()[:200]
    if title.isupper() and len(title) > 3:
        words = []
        for index, word in enumerate(title.split()):
            if word in ACRONYMS: words.append(ACRONYMS[word])
            elif index and word.lower() in SMALL: words.append(word.lower())
            else: words.append(word.capitalize())
        title = ' '.join(words)
    return title

def safe_project(p):
    if not isinstance(p, dict): return False
    ident, title, cover, url = (p.get(k) for k in ('id', 'title', 'cover', 'url'))
    link = LINK.fullmatch(url) if isinstance(url, str) else None
    image = LOCAL_COVER.fullmatch(cover) if isinstance(cover, str) else None
    stamp = p.get('publishedOn')
    return (isinstance(ident, str) and link is not None and image is not None
            and link[1] == ident == image[1] and isinstance(title, str)
            and 0 < len(title) <= 200 and not re.search(r'[\x00-\x1f\x7f]', title)
            and isinstance(stamp, int) and not isinstance(stamp, bool)
            and 946684800 <= stamp <= 4102444800)

def category(title):
    if re.search(r'motion|explainer|animation|video', title, re.I): return 'motion', 'Motion graphics'
    if re.search(r'brand|identity|logo', title, re.I): return 'brand', 'Brand identity'
    if re.search(r'poster|flyer|game day|frenzy|campaign|event', title, re.I): return 'campaign', 'Poster & campaign design'
    return 'other', 'Visual design'

def featured_html(html, projects, overrides=None):
    if html.count(START) != 1 or html.count(END) != 1: raise ValueError('Featured markers missing or duplicated')
    outside = re.sub(re.escape(START) + r'.*?' + re.escape(END), '', html, flags=re.S)
    curated = set(re.findall(r'<a\b(?=[^>]*\bdata-project=)[^>]*href="https://www\.behance\.net/gallery/(\d{5,12})/', outside))
    selected = sorted((p for p in projects if safe_project(p) and p['id'] not in curated),
                      key=lambda p: (p['publishedOn'], int(p['id'])), reverse=True)[:3]
    parts = []
    if selected:
        parts.append('<div class="fresh-work-intro"><span class="eyebrow">FRESH FROM BEHANCE</span><h3>New ideas, just landed.</h3></div>')
    for p in selected:
        kind, label = category(p['title'])
        title = escape(p.get('displayTitle') or display_title(p, overrides), quote=True)
        url, cover = (escape(p[k], quote=True) for k in ('url', 'cover'))
        parts.append(f'<article class="project-card fresh-project-card" data-category="{kind}"><a class="project-link" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{title} — view full project on Behance"><div class="project-image image-live"><img src="{cover}" alt="{title} by Kym Gfx" width="404" height="316" loading="lazy"><span class="project-type">{label}</span><span class="fresh-badge">Featured</span></div><div class="project-meta"><div><h3>{title}</h3><p>{escape(label)}. View the full project on Behance.</p></div><span class="project-number">NEW</span></div></a></article>')
    rendered = re.sub(re.escape(START) + r'.*?' + re.escape(END),
                      lambda _: START + '\n' + '\n'.join(parts) + '\n' + END, html, flags=re.S)
    count = len(re.findall(r'<article\b[^>]*class="[^\"]*\bproject-card\b', rendered))
    number = str(count).zfill(2)
    rendered = re.sub(r'(<span\b[^>]*id="project-count"[^>]*>)[^<]*(</span>)',
                      lambda m: m[1] + number + (' project' if count == 1 else ' projects') + m[2], rendered)
    rendered = re.sub(r'(<button\b[^>]*data-filter="all"[^>]*>[^<]*<span>)[^<]*(</span>)',
                      lambda m: m[1] + number + m[2], rendered)
    return rendered

def stamp_html(html, root):
    def stamp(match):
        tag = match[0]; attr = 'href' if tag.startswith('<link') else 'src'
        name = re.search(r'\b' + attr + r'="([^"?]+)', tag)[1]
        source = root / name.lstrip('/')
        if not source.is_file(): source = root / Path(name).name
        raw = source.read_bytes()
        tag = re.sub(r'\b' + attr + r'="[^"]+"', lambda _: attr + '="' + name + '?v=' + hashlib.sha256(raw).hexdigest()[:12] + '"', tag)
        tag = re.sub(r'\s+(?:integrity|crossorigin)="[^"]*"', '', tag)
        point = tag.index('>')
        return tag[:point] + ' integrity="' + digest(raw, 'sha384') + '" crossorigin="anonymous"' + tag[point:]
    html = re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>|<script\b[^>]*src="[^"?]+\.js(?:\?[^"\s]*)?"[^>]*></script>', stamp, html)
    hashes = ' '.join("'" + digest(t.encode()) + "'" for t in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S))
    frame = "frame-src https://tally.so" if '<iframe' in html else "frame-src 'none'"
    policy = ("default-src 'none'; script-src 'self' " + hashes + "; style-src 'self'; img-src 'self' data:; "
              "media-src 'self' data:; font-src 'self' data:; script-src-attr 'none'; style-src-attr 'none'; "
              "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action mailto:; " + frame + "; "
              "worker-src 'none'; manifest-src 'none'")
    return re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]+">',
                  lambda _: '<meta http-equiv="Content-Security-Policy" content="' + policy + '">', html)

def stamp_pages(root=ROOT):
    for name in PAGES:
        path = root / name
        atomic_write(path, stamp_html(path.read_text(encoding='utf-8'), root))

def save_snapshot(root, state):
    projects = state.get('projects')
    if state.get('profileUrl') != PROFILE or not isinstance(projects, list) or not 1 <= len(projects) <= 24:
        raise ValueError('Invalid portfolio snapshot')
    if not all(safe_project(p) and (root / p['cover']).is_file() for p in projects): raise ValueError('Invalid project or missing cover')
    if len({p['id'] for p in projects}) != len(projects): raise ValueError('Duplicate project')
    index = root / 'index.html'; old_index = index.read_bytes()
    rendered = stamp_html(featured_html(old_index.decode('utf-8'), projects, load_overrides(root)), root)
    raw = json.dumps(state, ensure_ascii=False, indent=2) + '\n'
    snapshot = root / 'portfolio.json'; old_snapshot = snapshot.read_bytes() if snapshot.exists() else None
    atomic_write(snapshot, raw)
    try: atomic_write(index, rendered)
    except Exception:
        if old_snapshot is not None: atomic_write(snapshot, old_snapshot)
        else: snapshot.unlink(missing_ok=True)
        raise

def web_files(root=ROOT):
    files = [root / name for name in FILES if (root / name).is_file()]
    files.extend(p for p in (root / 'assets').rglob('*') if p.is_file())
    return sorted(files)
