'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../portfolio.js'), 'utf8');
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.className = ''; this.dataset = {}; this.listeners = {}; this.classList = {contains: n => this.className.split(' ').includes(n), add: n => {this.className += ' ' + n;}}; }
  set innerHTML(v) { throw Error('HTML injection'); }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  insertBefore(node, anchor) { node.parent = this; const i = this.children.indexOf(anchor); this.children.splice(i < 0 ? this.children.length : i, 0, node); }
  remove() { const i = this.parent.children.indexOf(this); this.parent.children.splice(i, 1); }
  setAttribute(k, v) { this[k] = v; }
  addEventListener(k, v) { this.listeners[k] = v; }
  querySelectorAll(selector) { return this.children.flatMap(n => [...((selector === 'a[data-project][href]' && n.tagName === 'a' && n.dataset.project) || (selector === '.fresh-work-intro, .fresh-project-card' && (n.classList.contains('fresh-work-intro') || n.classList.contains('fresh-project-card'))) ? [n] : []), ...n.querySelectorAll(selector)]); }
}
const project = (id, title, publishedOn) => ({id, title, publishedOn, url: 'https://www.behance.net/gallery/' + id + '/Public-Project', cover: 'assets/behance/' + id + '-0123456789abcdef.png'});
async function run(projects, fail = false) {
  const grid = new Element('div'), ids = ['255600777','255861119','255859293','256715563','255861045','255860675'];
  for (const id of ids) { const card = new Element('article'), link = new Element('a'); card.className = 'project-card'; link.href = 'https://www.behance.net/gallery/' + id + '/Curated'; link.dataset.project = id; card.append(link); grid.append(card); }
  const originals = grid.children.slice(), staticCard = new Element('article'); staticCard.className = 'project-card fresh-project-card'; grid.insertBefore(staticCard, originals[4]);
  const events = []; let requested;
  vm.runInNewContext(source, {document: {getElementById: () => grid, createElement: tag => new Element(tag)}, window: {dispatchEvent: e => events.push(e.type)}, fetch: async url => {requested = url; return {ok: !fail, json: async () => ({profileUrl: 'https://www.behance.net/kymgfx0', projects})};}, AbortController, setTimeout: () => 0, clearTimeout() {}, CustomEvent: class {constructor(type) {this.type = type;}}});
  await new Promise(resolve => setImmediate(resolve)); return {grid, originals, staticCard, events, requested};
}
(async () => {
  const good = [project('299999999', '<script>alert(1)</script> Motion', 1800000000), project('299999998', 'Poster', 1799999999), project('255600777', 'Curated duplicate', 1800000001)];
  const f = await run(good); assert.equal(f.requested, 'portfolio.json'); assert(f.originals.slice(0, 4).every((n, i) => f.grid.children[i] === n));
  const fresh = f.grid.children.filter(n => n.classList.contains('fresh-project-card')); assert.equal(fresh.length, 2); assert(!f.grid.children.includes(f.staticCard));
  assert.equal(fresh[0].children[0].children[1].children[0].children[0].textContent, good[0].title); assert.equal(fresh[0].children[0].rel, 'noopener noreferrer'); assert.deepEqual(f.events, ['portfolio-ready']);
  for (const result of [await run(good, true), await run([{...good[0], cover: '../../evil.svg'}]), await run([{...good[0], url: 'javascript:alert(1)'}]), await run([good[0], good[0]]), await run(Array(25).fill(good[0]))]) assert(result.grid.children.includes(result.staticCard), 'Invalid data/fetch failure must keep static work');
  console.log('Portable featured checks passed: relative fetch, curated deduplication, safe local covers/text, static replacement, four-card order and failure fallback.');
})().catch(error => {console.error(error); process.exitCode = 1;});
