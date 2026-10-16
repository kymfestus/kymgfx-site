"""Route test under Wrangler's real static-asset routing (not a simple file server).
Optional dev tool: needs Node. Set WRANGLER=/path/to/wrangler, or it falls back to `npx wrangler`.
Run from the repo root:  python3 tools/test-routes.py
"""
import os, pathlib, shutil, subprocess, sys, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8797
cmd = [os.environ["WRANGLER"]] if os.environ.get("WRANGLER") else ["npx", "--yes", "wrangler"]
if not os.environ.get("WRANGLER") and not shutil.which("npx"):
    print("skipped: npx not found (set WRANGLER to a wrangler binary)"); sys.exit(0)
log = open("/tmp/test-routes-wrangler.log", "w")
proc = subprocess.Popen(cmd + ["dev", "--local", "--port", str(PORT), "--ip", "127.0.0.1"], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
BASE = f"http://127.0.0.1:{PORT}"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
def get(path, method="GET", headers=None, data=None):
    req = urllib.request.Request(BASE + path, method=method, headers=headers or {}, data=data)
    try:
        r = opener.open(req, timeout=20); return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

up = False
for _ in range(90):
    time.sleep(1)
    try: get("/index.html"); up = True; break
    except Exception: pass
fails = []
def check(name, cond, extra=""):
    print(("  ok  " if cond else "FAIL  ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond: fails.append(name)
if not up:
    print("could not start wrangler dev; see /tmp/test-routes-wrangler.log"); proc.terminate(); sys.exit(1)
try:
    nav = {"Sec-Fetch-Mode": "navigate"}
    s, h, b = get("/", headers=nav)
    check("/ serves the home page (200)", s == 200 and b"<html" in b.lower() and b"Design that" in b, f"{s}")
    check("/ is the same page as /index.html", b == get("/index.html")[2])
    check("/ carries the security headers", "frame-ancestors" in h.get("Content-Security-Policy", h.get("content-security-policy", "")) and h.get("X-Content-Type-Options", h.get("x-content-type-options")) == "nosniff", str(h)[:200])
    check("HEAD / works", get("/", method="HEAD", headers=nav)[0] == 200)
    check("/?utm_source=x still serves the home page", get("/?utm_source=x", headers=nav)[0] == 200)
    for path in ["/index.html", "/book.html", "/start.html", "/404.html", "/styles.css", "/chat.js", "/app.js", "/portfolio.json", "/sitemap.xml", "/robots.txt", "/assets/share.png", "/assets/logo.svg"]:
        check(f"{path} is 200", get(path, headers=nav if path.endswith(".html") else None)[0] == 200)
    s, h, b = get("/does-not-exist", headers=nav)
    check("unknown pages return the custom 404 page with status 404", s == 404 and b"different direction" in b, f"{s}")
    check("/onboarding.html redirects to /start.html", get("/onboarding.html")[0] == 301 and "start.html" in get("/onboarding.html")[1].get("Location", get("/onboarding.html")[1].get("location", "")))
    for private in ["/worker/index.mjs", "/wrangler.jsonc", "/tools/check-site.py", "/deployment/AI-ASSISTANT.md", "/.assetsignore", "/SHA256SUMS.txt"]:
        check(f"{private} is not public", get(private, headers=nav)[0] == 404)
    s, h, b = get("/api/chat")
    check("GET /api/chat is 405 json from the Worker", s == 405 and b'"method_not_allowed"' in b)
    s, h, b = get("/api/chat", method="POST", headers={"Content-Type": "application/json", "Origin": "https://evil.example"}, data=b'{"messages":[{"role":"user","content":"hi"}]}')
    check("cross-origin POST /api/chat is refused", s == 403, f"{s}")
finally:
    proc.terminate()
print("\n" + ("ALL ROUTE CHECKS PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
