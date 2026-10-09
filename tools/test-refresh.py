#!/usr/bin/env python3
"""Regression tests for unsafe imports, failed refresh retention and static insertion."""
import copy, datetime, email.utils, importlib.util, json, shutil, tempfile, time, unittest
from pathlib import Path
from html import escape
from site_tools import ROOT, save_snapshot

spec = importlib.util.spec_from_file_location('refresh', ROOT / 'tools/refresh-behance.py')
updater = importlib.util.module_from_spec(spec); spec.loader.exec_module(updater)

def feed(projects, owner='https://www.behance.net/kymgfx0'):
    items = []
    for p in projects:
        description = '<img src="' + p['coverSource'] + '">'
        items.append('<item><title>' + escape(p['title']) + '</title><link>' + escape(p['url']) + '</link><pubDate>' + email.utils.formatdate(p['publishedOn'], usegmt=True) + '</pubDate><description>' + escape(description) + '</description></item>')
    return ('<rss version="2.0"><channel><link>' + owner + '</link>' + ''.join(items) + '</channel></rss>').encode()

class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.project = {'id': '299999999', 'title': '<img src=x onerror=alert(1)> New motion', 'url': 'https://www.behance.net/gallery/299999999/New-Motion', 'coverSource': 'https://mir-s3-cdn-cf.behance.net/projects/404/test-cover.png', 'publishedOn': int(time.time()) - 120}
        self.raw = feed([self.project])

    def test_reject_bad_rss_and_urls(self):
        self.assertEqual(updater.parse_feed(self.raw)[0]['title'], self.project['title'])
        for bad in [feed([self.project], 'https://www.behance.net/other'), feed([self.project, self.project]), b'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + self.raw]:
            with self.assertRaises(Exception): updater.parse_feed(bad)
        for key, value in [('url', 'javascript:alert(1)'), ('coverSource', 'https://evil.example/cover.png'), ('coverSource', 'https://mir-s3-cdn-cf.behance.net/projects/404/test.svg'), ('coverSource', 'https://mir-s3-cdn-cf.behance.net/projects/404/test.png?token=x'), ('title', 'x' * 201)]:
            bad = {**self.project, key: value}
            with self.assertRaises(Exception): updater.parse_feed(feed([bad]))
        for raw in [b'<svg onload="alert(1)"></svg>', b'not an image' * 3, b'x' * (updater.MAX_IMAGE + 1)]:
            with self.assertRaises(ValueError): updater.raster_ext(raw)

    def test_failure_retains_saved_work_and_success_inserts_escaped_work(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'site'; shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns('__pycache__'))
            old_json = (root / 'portfolio.json').read_bytes(); old_html = (root / 'index.html').read_bytes()
            def failing(url, limit):
                if url == updater.FEED: return self.raw
                raise ValueError('Simulated cover download failure')
            with self.assertRaises(ValueError): updater.refresh(root, failing)
            self.assertEqual(old_json, (root / 'portfolio.json').read_bytes())
            self.assertEqual(old_html, (root / 'index.html').read_bytes())
            # Use an actual exported raster as the new cover fixture.
            state = json.loads(old_json); image = (root / state['projects'][0]['cover']).read_bytes()
            result = updater.refresh(root, lambda url, limit: self.raw if url == updater.FEED else image)
            self.assertEqual(result['status'], 'updated'); self.assertEqual(len(result['newProjects']), 1)
            html = (root / 'index.html').read_text()
            self.assertIn('&lt;img src=x onerror=alert(1)&gt; New motion', html)
            self.assertNotIn('<img src=x onerror=alert(1)>', html)
            self.assertEqual(html.count('data-project='), old_html.decode().count('data-project='))
            self.assertEqual(html.count('class="project-card"'), 6)
            self.assertEqual(html.count('class="project-card fresh-project-card"'), 1)
            saved = json.loads((root / 'portfolio.json').read_text())
            self.assertTrue((root / saved['projects'][0]['cover']).is_file())
            result2 = updater.refresh(root, lambda url, limit: self.raw if url == updater.FEED else image)
            self.assertEqual(result2['status'], 'unchanged')

if __name__ == '__main__': unittest.main()
