// Kym Gfx project assistant: one endpoint, POST /api/chat, same origin only.
// Runs on Cloudflare Workers with the Workers AI binding. Static files are served
// by the assets binding and never reach this code (see run_worker_first in wrangler.jsonc).

import { buildSystemPrompt, CANARY } from './knowledge.mjs';

// Swap this one line to change models. Check the Workers AI pricing page first:
// some models need a paid plan, and old ones get retired.
const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

const MAX_BODY_BYTES = 6000;   // whole request
const MAX_TURNS = 10;          // messages of history sent to the model
const MAX_MESSAGE_CHARS = 500; // one visitor message
const MAX_OUTPUT_TOKENS = 380;
const MODEL_TIMEOUT_MS = 25000;
const PROJECT_CACHE_MS = 10 * 60 * 1000;

let projectCache = { at: 0, list: [] };

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

async function loadProjects(request, env) {
  const now = Date.now();
  if (projectCache.list.length && now - projectCache.at < PROJECT_CACHE_MS) return projectCache.list;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/portfolio.json', request.url)));
    if (!res.ok) throw new Error('portfolio ' + res.status);
    const data = await res.json();
    const list = (data.projects || [])
      .filter((p) => /^\d{6,12}$/.test(String(p.id)) && typeof p.url === 'string' && p.url.startsWith('https://www.behance.net/'))
      .map((p) => ({ id: String(p.id), title: String(p.displayTitle || p.title || '').slice(0, 80), url: p.url }));
    projectCache = { at: now, list };
    return list;
  } catch {
    return projectCache.list; // stale list is better than none
  }
}

export function validateMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const clean = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const content = m.content.replace(/\s+/g, ' ').trim().slice(0, m.role === 'user' ? MAX_MESSAGE_CHARS : 1500);
    if (!content) return null;
    clean.push({ role: m.role, content });
  }
  if (clean[clean.length - 1].role !== 'user') return null;
  // Models behave better when the history starts with the visitor.
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean.length ? clean : null;
}

function textOf(out) {
  if (typeof out === 'string') return out;
  if (!out || typeof out !== 'object') return '';
  if (typeof out.response === 'string') return out.response;
  const choice = out.choices && out.choices[0];
  if (choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
  if (out.result && typeof out.result.response === 'string') return out.result.response;
  return '';
}

export function cleanReply(text, projects) {
  let t = String(text || '');
  const actions = [];
  const wanted = [];

  t = t.replace(/\[\[\s*(start|book)\s*\]\]/gi, (_, a) => { a = a.toLowerCase(); if (!actions.includes(a)) actions.push(a); return ''; });
  t = t.replace(/\[\[\s*project\s*:\s*(\d{6,12})\s*\]\]/gi, (_, id) => { if (!wanted.includes(id)) wanted.push(id); return ''; });
  t = t.replace(/\[\[[^\]]*\]\]/g, '');

  // The model must never publish links or contact details of its own.
  t = t.replace(/https?:\/\/\S+/gi, '').replace(/\bwww\.\S+/gi, '').replace(/\S+@\S+\.\S+/g, '');

  // Owner's house rule: no long dashes. Ranges become "x to y".
  t = t.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2').replace(/\s*(?:[\u2013\u2014]|--)\s*/g, ', ');

  // Plain text only.
  t = t.replace(/[*_`#]+/g, '').replace(/^\s*[-\u2022]\s+/gm, '');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  t = t.replace(/^(assistant|ai)\s*:\s*/i, '');
  if (t.length > 1400) t = t.slice(0, 1400).replace(/\s+\S*$/, '') + '...';

  const byId = new Map(projects.map((p) => [p.id, p]));
  const picked = wanted.filter((id) => byId.has(id)).slice(0, 3).map((id) => ({ title: byId.get(id).title, url: byId.get(id).url }));
  return { reply: t, actions, projects: picked };
}

async function ask(env, system, messages) {
  const run = env.AI.run(MODEL, {
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.3,
  });
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), MODEL_TIMEOUT_MS); });
  try { return await Promise.race([run, timeout]); } finally { clearTimeout(timer); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // html_handling is "none" so that /book.html stays /book.html. The side effect is that
    // the bare domain has no file to match, so we hand "/" the home page here.
    if (url.pathname === '/') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' });
      return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    }

    if (url.pathname !== '/api/chat') {
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });

    // Same-origin only. Browsers always send these on a fetch from our own pages.
    const origin = request.headers.get('Origin');
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* ignore */ }
      if (host !== url.host) return json({ error: 'forbidden' }, 403);
    }
    const site = request.headers.get('Sec-Fetch-Site');
    if (site && site !== 'same-origin') return json({ error: 'forbidden' }, 403);

    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
      return json({ error: 'bad_request' }, 415);
    }
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

    // Soft per-visitor limit. Counters are per Cloudflare location, so this slows
    // abuse down; it is not a hard cap. The daily Workers AI allowance is the hard cap.
    if (env.CHAT_LIMITER) {
      const key = request.headers.get('CF-Connecting-IP') || 'anonymous';
      const { success } = await env.CHAT_LIMITER.limit({ key });
      if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '30' });
    }

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
      body = JSON.parse(text);
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    const messages = validateMessages(body && body.messages);
    if (!messages) return json({ error: 'bad_request' }, 400);

    const projects = await loadProjects(request, env);

    let out;
    try {
      out = await ask(env, buildSystemPrompt(projects), messages);
    } catch {
      return json({ error: 'unavailable' }, 502);
    }

    const raw = textOf(out);
    if (!raw.trim() || raw.includes(CANARY)) return json({ error: 'unavailable' }, 502);
    const { reply, actions, projects: picked } = cleanReply(raw, projects);
    if (!reply) return json({ error: 'unavailable' }, 502);
    return json({ reply, actions, projects: picked });
  },
};
