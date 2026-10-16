"""Browser test for the chat widget with a mocked /api/chat. Run: python3 tools/test-chat-ui.py"""
import json, subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8791
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = f"http://localhost:{PORT}"
fails = []
def check(name, cond, extra=""):
    print(("  ok  " if cond else "FAIL  ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond: fails.append(name)

BRIEF = "Great, here is a brief you can send.\n\nPROJECT BRIEF\nNeed: Logo and brand identity\nGoal: Launch a coffee brand\nTimeline: Within a month\nBudget range: Not shared yet\n\nSend this through the project form so Kym can review it."
state = {"mode": "ok", "requests": []}

def handler(route):
    req = route.request
    state["requests"].append(json.loads(req.post_data or "{}"))
    m = state["mode"]
    if m == "502": return route.fulfill(status=502, content_type="application/json", body='{"error":"unavailable"}')
    if m == "429": return route.fulfill(status=429, content_type="application/json", body='{"error":"rate_limited"}')
    if m == "brief": return route.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": BRIEF, "actions": ["start"], "projects": []}))
    if m == "xss": return route.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": "<img src=x onerror=window.__pwned=1><script>window.__pwned=1</script> hello", "actions": ["start", "javascript:alert(1)"], "projects": [{"title": "Evil", "url": "javascript:alert(1)"}]}))
    return route.fulfill(status=200, content_type="application/json", body=json.dumps({
        "reply": "A logo usually starts around KES 15,000 to 25,000. Want to tell me about your project?",
        "actions": ["start", "book"],
        "projects": [{"title": "Lisa GTI Brand Guidelines", "url": "https://www.behance.net/gallery/255600777/LISA-GTI-BRAND-GUIDELINES"}]}))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
    csp, errors = [], []
    page = ctx.new_page()
    page.on("console", lambda m: (csp if "Content Security Policy" in m.text or "Refused" in m.text else errors).append(m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/api/chat", handler)
    page.route("https://tally.so/**", lambda r: r.abort())
    page.goto(BASE + "/index.html"); page.wait_for_timeout(600)

    launcher = page.locator("button.chat-launch")
    check("launcher joins the dock as a third action", page.locator(".contact-dock .dock-action").count() == 3 and launcher.count() == 1)
    check("launcher has accessible name and collapsed state", launcher.get_attribute("aria-label") and launcher.get_attribute("aria-expanded") == "false")
    box = launcher.bounding_box(); check("launcher is a 44px circle", abs(box["width"] - 44) < 1.5 and abs(box["height"] - 44) < 1.5, str(box))
    check("panel hidden at load", page.locator("#chat-panel").is_hidden())

    launcher.click(); page.wait_for_timeout(200)
    check("panel opens, expanded state set", page.locator("#chat-panel").is_visible() and launcher.get_attribute("aria-expanded") == "true")
    check("focus lands in the message box", page.evaluate("document.activeElement.classList.contains('chat-input')"))
    check("greeting and 3 starter chips shown", page.locator(".chat-bot").count() == 1 and page.locator(".chat-chip").count() == 3)
    check("dock stays visible while typing in chat", page.evaluate("!document.querySelector('.contact-dock').hidden"))
    page.screenshot(path="/tmp/chat-desktop-open.png")

    page.locator(".chat-chip").first.click(); page.wait_for_selector(".chat-bot:nth-child(3)"); page.wait_for_timeout(200)
    check("chip sends exactly one user message", state["requests"][-1]["messages"] == [{"role": "user", "content": "What does a logo cost?"}])
    check("reply rendered with Start, Request and project buttons", page.locator(".chat-actions a").count() == 3)
    proj = page.locator(".chat-actions a[target=_blank]")
    check("project link opens safely in new tab", proj.count() == 1 and "noopener" in proj.get_attribute("rel") and proj.get_attribute("href").startswith("https://www.behance.net/"))
    check("chips hidden after first message", page.locator(".chat-chips").is_hidden())
    page.screenshot(path="/tmp/chat-desktop-reply.png")

    # keyboard
    page.fill(".chat-input", "line one"); page.press(".chat-input", "Shift+Enter"); page.type(".chat-input", "line two")
    check("Shift+Enter adds a newline without sending", "\n" in page.input_value(".chat-input") and len(state["requests"]) == 1)
    page.fill(".chat-input", "Sounds good"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    check("Enter sends; history carries earlier turns in order", [m["role"] for m in state["requests"][-1]["messages"]] == ["user", "assistant", "user"])
    check("input cleared and re-focused after reply", page.input_value(".chat-input") == "" and page.evaluate("document.activeElement.classList.contains('chat-input')"))

    # brief + copy
    state["mode"] = "brief"; page.fill(".chat-input", "Make me a brief"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    copy = page.locator("button.chat-btn", has_text="Copy brief"); check("brief reply offers Copy brief", copy.count() == 1)
    copy_el = copy.element_handle(); copy.click(); page.wait_for_timeout(300)
    clip = page.evaluate("navigator.clipboard.readText()")
    check("clipboard holds only the brief block", clip.startswith("PROJECT BRIEF") and "Budget range: Not shared yet" in clip and "Send this through" not in clip, clip[:80])
    check("copy button confirms", copy_el.inner_text() == "Copied")

    # errors never poison history
    state["mode"] = "502"; page.fill(".chat-input", "hello?"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    check("502 shows fallback with form and call buttons", page.locator(".chat-bot").last.inner_text().startswith("I can't reach") and page.locator(".chat-bot").last.locator("a").count() == 2)
    state["mode"] = "429"; page.fill(".chat-input", "again"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    check("429 shows a calm rate message", "quickly" in page.locator(".chat-bot").last.inner_text())
    state["mode"] = "ok"; page.fill(".chat-input", "back now"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    sent = state["requests"][-1]["messages"]
    check("error replies are never sent back to the model", all("can't reach" not in m["content"] and "quickly" not in m["content"] for m in sent), str(sent)[-200:])

    # hostile output stays inert
    state["mode"] = "xss"; page.fill(".chat-input", "test"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    check("HTML in a reply renders as text, nothing executes", page.evaluate("window.__pwned") is None and page.locator(".chat-bot img").count() == 0 and "<img" in page.locator(".chat-bot").last.inner_text())
    check("non-allowlisted links and actions are dropped", all(not (h or "").startswith("javascript") for h in page.eval_on_selector_all(".chat-actions a", "els=>els.map(e=>e.getAttribute('href'))")))
    state["mode"] = "ok"

    # persistence across pages
    n_before = page.locator(".chat-msg").count()
    page.goto(BASE + "/book.html"); page.wait_for_timeout(500)
    page.locator("button.chat-launch").click(); page.wait_for_timeout(200)
    check("conversation survives navigation", page.locator(".chat-msg").count() == n_before)
    page.fill(".chat-input", "go"); page.press(".chat-input", "Enter"); page.wait_for_timeout(500)
    last_actions = [a.inner_text() for a in page.locator(".chat-bot").last.locator(".chat-actions a").all()]
    check("on the booking page the 'Request a call' button is not offered", "Request a call" not in last_actions and "Start a project" in last_actions, str(last_actions))

    # escape + focus return + reset
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    check("Escape closes and returns focus to the launcher", page.locator("#chat-panel").is_hidden() and page.evaluate("document.activeElement.classList.contains('chat-launch')"))
    page.locator("button.chat-launch").click(); page.locator(".chat-reset").click(); page.wait_for_timeout(200)
    check("New chat clears the conversation", page.locator(".chat-msg").count() == 1 and page.locator(".chat-chip").count() == 3)

    check("no CSP violations during the whole run", not csp, "; ".join(csp)[:300])
    check("no JavaScript errors", not [e for e in errors if "tally" not in e.lower() and "ERR_FAILED" not in e and "Failed to load resource" not in e], "; ".join(errors)[:300])

    # mobile
    m = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = m.new_page(); mp.route("**/api/chat", handler); mp.route("https://tally.so/**", lambda r: r.abort())
    mp.goto(BASE + "/index.html"); mp.wait_for_timeout(600)
    mp.locator("button.chat-launch").tap(); mp.wait_for_timeout(300)
    r = mp.locator("#chat-panel").bounding_box()
    check("mobile panel fits inside the viewport", r["x"] >= 0 and r["x"] + r["width"] <= 390.5 and r["y"] >= 0 and r["y"] + r["height"] <= 844.5, str(r))
    check("mobile dock is hidden while chat is open", mp.evaluate("getComputedStyle(document.querySelector('.contact-dock')).display") == "none")
    check("mobile text box is 16px (no iOS zoom)", mp.evaluate("getComputedStyle(document.querySelector('.chat-input')).fontSize") == "16px")
    small = mp.evaluate("[...document.querySelectorAll('#chat-panel button, #chat-panel a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>e.className+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))")
    check("every chat control is at least 44x44 on mobile", not small, str(small))
    check("page does not scroll sideways on mobile", mp.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"))
    mp.locator(".chat-chip").first.tap(); mp.wait_for_timeout(600)
    mp.screenshot(path="/tmp/chat-mobile.png")
    mp.locator(".chat-close").tap(); mp.wait_for_timeout(200)
    check("closing on mobile restores the dock", mp.evaluate("getComputedStyle(document.querySelector('.contact-dock')).display") != "none")
    b.close()
server.terminate()
print("\n" + ("ALL CHAT UI CHECKS PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)
