(function () {
  'use strict';
  // Project assistant widget. Plain DOM only (no innerHTML), talks to /api/chat on this origin.
  const doc = document;
  const dock = doc.querySelector('.contact-dock');
  if (!dock) return;

  const NS = 'http://www.w3.org/2000/svg';
  const STORE = 'kg-chat-v1';
  const MAX_STORED = 20;
  const MAX_SENT = 10;
  // Privacy-first default: keep the conversation in memory only. Set to true to keep it in this
  // tab's sessionStorage so it survives moving between pages (it is still cleared when the tab closes).
  const PERSIST_CHAT = false;
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const GREETING = "Hi, I'm the Kym Gfx AI assistant. I can explain services and typical prices, help you shape a project brief, or point you to relevant work. What are you working on?";
  const NOTE_TEXT = 'AI can make mistakes, and Kym confirms every quote. Your chat is not saved in your browser. Please do not share sensitive personal details here.';
  const FALLBACK = "I can't reach the assistant right now. You can still send your project details through the project form, or request a discovery call, and Kym will reply.";
  const RATE_TEXT = "You're sending messages quickly. Give it a minute and try again.";
  const STARTERS = ['What does a logo cost?', 'Help me scope a project', 'Show me work like mine'];

  let messages = load();
  let busy = false;

  function el(tag, cls, text) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const use = doc.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function load() {
    if (!PERSIST_CHAT) {
      try { sessionStorage.removeItem(STORE); } catch (e) { /* storage can be unavailable */ }
      return [];
    }
    try {
      const raw = JSON.parse(sessionStorage.getItem(STORE) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_STORED).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1500),
        error: !!m.error,
        actions: Array.isArray(m.actions) ? m.actions.filter((a) => a === 'start' || a === 'book') : [],
        projects: Array.isArray(m.projects) ? m.projects.filter((p) => p && typeof p.title === 'string' && typeof p.url === 'string' && p.url.indexOf('https://www.behance.net/') === 0).slice(0, 3) : [],
      }));
    } catch (e) { return []; }
  }
  function save() {
    if (!PERSIST_CHAT) return;
    try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-MAX_STORED))); } catch (e) { /* storage can be unavailable */ }
  }

  // ---- Launcher (joins the existing contact dock) ----
  const launcher = el('button', 'dock-action hover-target chat-launch');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Chat with the project assistant');
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.appendChild(icon('message'));
  const hoverLabel = el('span', 'hover-label', 'Ask the assistant');
  hoverLabel.setAttribute('aria-hidden', 'true');
  launcher.appendChild(hoverLabel);
  dock.appendChild(launcher);

  // ---- Panel ----
  const panel = el('section', 'chat-panel');
  panel.id = 'chat-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Project assistant');
  launcher.setAttribute('aria-controls', panel.id);

  const head = el('div', 'chat-head');
  const titles = el('div', 'chat-titles');
  titles.appendChild(el('strong', 'chat-title', 'Project assistant'));
  titles.appendChild(el('span', 'chat-sub', 'AI helper for Kym Gfx'));
  const resetBtn = el('button', 'chat-iconbtn chat-reset', 'New chat');
  resetBtn.type = 'button';
  const closeBtn = el('button', 'chat-iconbtn chat-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close chat');
  closeBtn.appendChild(icon('close'));
  head.append(titles, resetBtn, closeBtn);

  const log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');
  log.tabIndex = 0;
  log.setAttribute('aria-label', 'Conversation');

  const chips = el('div', 'chat-chips');
  STARTERS.forEach((text) => {
    const chip = el('button', 'chat-chip', text);
    chip.type = 'button';
    chip.addEventListener('click', () => send(text));
    chips.appendChild(chip);
  });

  const composer = el('div', 'chat-composer');
  const input = el('textarea', 'chat-input');
  input.rows = 1;
  input.maxLength = 500;
  input.placeholder = 'Ask about services or prices';
  input.setAttribute('aria-label', 'Your message');
  input.autocomplete = 'off';
  const sendBtn = el('button', 'chat-send', 'Send');
  sendBtn.type = 'button';
  composer.append(input, sendBtn);

  const note = el('p', 'chat-note', NOTE_TEXT);
  const live = el('p', 'sr-only');
  live.setAttribute('role', 'status');
  panel.append(head, log, chips, composer, note, live);
  doc.body.appendChild(panel);

  // ---- Rendering ----
  function paragraphs(text) {
    const wrap = el('div', 'chat-text');
    text.split(/\n{2,}/).forEach((chunk) => {
      const p = el('p');
      const lines = chunk.split('\n');
      lines.forEach((line, i) => { if (i) p.appendChild(doc.createElement('br')); p.appendChild(doc.createTextNode(line)); });
      wrap.appendChild(p);
    });
    return wrap;
  }
  function briefOf(text) {
    const i = text.search(/^\s*PROJECT BRIEF/m);
    if (i < 0) return '';
    const chunks = text.slice(i).split(/\n\s*\n/);
    const first = chunks[0].trim();
    return (first.split('\n').length < 2 && chunks[1] ? first + '\n' + chunks[1].trim() : first).trim();
  }
  function linkBtn(label, href, primary, external) {
    const a = el('a', 'chat-btn' + (primary ? ' chat-btn-primary' : ''), label);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  function copyBrief(text, btn) {
    const done = () => {
      btn.textContent = 'Copied';
      live.textContent = 'Brief copied to clipboard';
      window.setTimeout(() => { btn.textContent = 'Copy brief'; }, 2200);
    };
    const fallback = () => {
      const area = el('textarea', 'sr-only');
      area.value = text;
      area.setAttribute('readonly', '');
      doc.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      if (ok) done(); else { btn.textContent = 'Select and copy it above'; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function renderMessage(m) {
    const row = el('div', 'chat-msg ' + (m.role === 'user' ? 'chat-user' : 'chat-bot'));
    row.appendChild(paragraphs(m.content));
    if (m.role === 'assistant') {
      const bar = el('div', 'chat-actions');
      const brief = briefOf(m.content);
      const wantStart = (m.actions || []).indexOf('start') >= 0 || m.error;
      const wantBook = (m.actions || []).indexOf('book') >= 0 || m.error;
      if (wantStart && page !== 'start.html') bar.appendChild(linkBtn('Start a project', 'start.html', true, false));
      if (wantBook && page !== 'book.html') bar.appendChild(linkBtn('Request a call', 'book.html', !wantStart || page === 'start.html', false));
      (m.projects || []).forEach((p) => bar.appendChild(linkBtn(p.title, p.url, false, true)));
      if (brief) {
        const copy = el('button', 'chat-btn', 'Copy brief');
        copy.type = 'button';
        copy.addEventListener('click', () => copyBrief(brief, copy));
        bar.appendChild(copy);
      }
      if (bar.childNodes.length) row.appendChild(bar);
    }
    return row;
  }
  function renderAll() {
    log.textContent = '';
    log.appendChild(renderMessage({ role: 'assistant', content: GREETING }));
    messages.forEach((m) => log.appendChild(renderMessage(m)));
    chips.hidden = messages.length > 0;
    scrollDown();
  }
  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }
  function showTyping() {
    const row = el('div', 'chat-msg chat-bot chat-typing');
    row.appendChild(el('p', null, 'Thinking'));
    row.id = 'chat-typing';
    log.appendChild(row);
    log.setAttribute('aria-busy', 'true');
    scrollDown();
  }
  function hideTyping() {
    const row = doc.getElementById('chat-typing');
    if (row) row.remove();
    log.removeAttribute('aria-busy');
  }
  function setBusy(state) {
    busy = state;
    sendBtn.disabled = state;
    input.setAttribute('aria-busy', state ? 'true' : 'false');
  }
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  }

  // ---- Talking to the Worker ----
  async function send(raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text || busy) return;
    messages.push({ role: 'user', content: text });
    save();
    input.value = '';
    autosize();
    chips.hidden = true;
    log.appendChild(renderMessage(messages[messages.length - 1]));
    scrollDown();
    setBusy(true);
    showTyping();

    const history = messages.filter((m) => !m.error).slice(-MAX_SENT).map((m) => ({ role: m.role, content: m.content }));
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 30000);
    let reply;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ messages: history }),
        signal: ctrl.signal,
      });
      if (res.status === 429) reply = { role: 'assistant', content: RATE_TEXT, error: true, actions: [], projects: [] };
      else if (!res.ok) throw new Error('status ' + res.status);
      else {
        const data = await res.json();
        if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('empty');
        reply = {
          role: 'assistant',
          content: data.reply.slice(0, 1500),
          actions: Array.isArray(data.actions) ? data.actions.filter((a) => a === 'start' || a === 'book') : [],
          projects: Array.isArray(data.projects) ? data.projects.filter((p) => p && typeof p.title === 'string' && typeof p.url === 'string' && p.url.indexOf('https://www.behance.net/') === 0).slice(0, 3) : [],
        };
      }
    } catch (e) {
      reply = { role: 'assistant', content: FALLBACK, error: true, actions: ['start', 'book'], projects: [] };
    } finally {
      window.clearTimeout(timer);
    }
    hideTyping();
    messages.push(reply);
    save();
    log.appendChild(renderMessage(reply));
    scrollDown();
    live.textContent = reply.content;
    setBusy(false);
    input.focus();
  }

  // ---- Open, close, reset ----
  function openPanel() {
    panel.hidden = false;
    doc.body.classList.add('chat-open');
    launcher.setAttribute('aria-expanded', 'true');
    renderAll();
    input.focus();
  }
  function closePanel(returnFocus) {
    input.blur();
    panel.hidden = true;
    doc.body.classList.remove('chat-open');
    launcher.setAttribute('aria-expanded', 'false');
    if (returnFocus) launcher.focus();
  }
  launcher.addEventListener('click', () => { if (panel.hidden) openPanel(); else closePanel(true); });
  closeBtn.addEventListener('click', () => closePanel(true));
  resetBtn.addEventListener('click', () => {
    messages = [];
    save();
    renderAll();
    live.textContent = 'Chat cleared';
    input.focus();
  });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(true); } });
  sendBtn.addEventListener('click', () => send(input.value));
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
})();
