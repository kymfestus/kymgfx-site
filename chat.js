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
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  const PERSIST_CHAT = false; // Privacy-first default: do not retain chat history in browser storage.
  const GREETING = "Hi, I'm the Kym Gfx AI assistant. I can explain services and typical prices, help you shape a project brief, or point you to relevant work. What are you working on?";
  const NOTE_TEXT = 'Privacy: this chat stays in memory only for this browser session and is not stored after you leave. Please do not share sensitive personal details here.';
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
    if (!PERSIST_CHAT) return [];
    try {
      const raw = JSON.parse(sessionStorage.getItem(STORE) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_STORED).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1500),
        error: !!m.error,
        actions: Array.isArray(m.actions) ? m.actions.filter((a) => a === 'start' || a === 'book') : [],
        projects: Array.isArray(m.projects) ? m.projects.filter((p) => p && typeof p.title === 'string' && typeof p.url === 'string' && p.url.indexOf('https://www.behance.net/') === 0).slice(0, 3) : []
      }));
    } catch (e) {
      return [];
    }
  }

  function save() {
    if (!PERSIST_CHAT) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch (e) {
      // storage can be unavailable
    }
  }

  // ... rest of the file stays the same
})();
