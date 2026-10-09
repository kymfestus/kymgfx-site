'use strict';
// Exercise real event handlers without a browser or external packages.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const dist = process.env.KYM_TEST_DIST || root;

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.attrs = {}; this.dataset = {}; this.style = {};
    this.children = []; this.listeners = {}; this.classes = new Set(); this.isConnected = true;
    this.classList = { toggle: (key, on) => on ? this.classes.add(key) : this.classes.delete(key), add: key => this.classes.add(key), remove: key => this.classes.delete(key) };
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(key, callback) { (this.listeners[key] ||= []).push(callback); }
  async emit(key, event = {}) { for (const callback of this.listeners[key] || []) await callback(event); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  contains(child) { return child === this || this.children.some(node => node.contains?.(child)); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(selector === 'video' && child.tagName === 'VIDEO' ? [child] : []), ...(child.querySelectorAll?.(selector) || [])]); }
  querySelector(selector) { return selector === '[data-media-error]' ? this.children.find(child => child.dataset.mediaError) : null; }
  focus() { this.document.activeElement = this; }
  pause() { this.paused = true; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 }; }
}

function fixture(options = {}) {
  const document = new Element('document');
  const ids = {};
  for (const id of ['project-dialog','dialog-media','dialog-title','dialog-category','dialog-description','dialog-tools','dialog-behance','dialog-behance-label','project-count','contact-service','copy-email','copy-email-label','copy-status','contact-form','form-status','year','header-nav']) ids[id] = new Element();
  const dialog = ids['project-dialog']; dialog.open = false;
  dialog.showModal = () => { if (options.failDialog) throw new Error('Dialog blocked'); dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.emit('close'); };
  if (options.unsupportedDialog) dialog.showModal = undefined;
  const projects = ['lisa','weekend','nova','gameday','safari','saas'].map(key => { const link = new Element('a'); link.dataset.project = key; link.document = document; return link; });
  const filters = ['all','brand','campaign','motion'].map(key => { const button = new Element('button'); button.dataset.filter = key; return button; });
  const cards = ['brand','campaign','motion','campaign','motion','motion'].map(category => { const card = new Element(); card.dataset.category = category; return card; });
  const services = ['Brand identity','Social & event campaigns','Motion & video','Website design'].map(service => { const link = new Element('a'); link.dataset.service = service; return link; });
  const header = new Element('header'), toggle = new Element('button'), profile = new Element('a');
  const nav = ids['header-nav']; const navLinks = [new Element('a'),new Element('a'),new Element('a'),new Element('a')];
  nav.children = navLinks; nav.querySelectorAll = () => navLinks;
  header.children = [nav,toggle,profile]; header.querySelector = selector => selector === '.menu-toggle' ? toggle : profile;
  [...navLinks,toggle,profile].forEach(element => element.document = document);
  const mediaQuery = new Element(); mediaQuery.matches = !!options.mobile;
  if (options.legacyMedia) { mediaQuery.addListener = callback => Element.prototype.addEventListener.call(mediaQuery, 'change', callback); mediaQuery.addEventListener = undefined; }
  const closeButton = new Element('button');
  document.documentElement = new Element('html'); document.body = new Element('body'); document.body.style.overflow = 'auto'; document.activeElement = document;
  document.getElementById = key => ids[key];
  document.createElement = tag => new Element(tag);
  document.createTextNode = text => ({ textContent: text });
  document.querySelector = selector => selector === '.dialog-close' ? closeButton : selector === '.site-header' ? header : null;
  document.querySelectorAll = selector => ({ '.email-form': [ids['contact-form']], '[data-year]': [ids['year']], '[data-project]': projects, '[data-filter]': filters, '.project-card': cards, '[data-service]': services })[selector] || [];
  const window = new Element('window'); window.location = { href: '' }; window.scrollY = 0; window.matchMedia = () => mediaQuery;
  let frames = []; window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  const navigator = options.noClipboard ? {} : { clipboard: { writeText: async text => { navigator.copied = text; } } };
  const form = ids['contact-form']; form.values = { name: 'A client', email: 'client@example.com', service: 'Brand identity', message: 'A new identity.' }; form.valid = true; form.reportValidity = () => form.valid;
  form.dataset.formKind='contact'; form.querySelector=() => ids['form-status'];
  const FormData = class { constructor(form) { this.values = form.values; } get(key) { return this.values[key]; } }; window.FormData=FormData;
  const context = vm.createContext({ document, window, location:window.location, navigator, Date, Intl, encodeURIComponent, queueMicrotask: callback => callback(), FormData });
  const run = file => { vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'), context); if(file==='app.js')vm.runInContext(fs.readFileSync(path.join(dist,'forms.js'),'utf8'),context); };
  const click = async element => { const event = { currentTarget: element, preventDefault() { this.prevented = true; } }; await element.emit('click', event); return event; };
  const submit = async () => { const event = { currentTarget: form, preventDefault() { this.prevented = true; } }; await form.emit('submit', event); return event; };
  const scroll = async position => { window.scrollY = position; await window.emit('scroll'); const pending = frames; frames = []; pending.forEach(callback => callback()); };
  return { document, ids, dialog, projects, filters, cards, services, header, toggle, nav, navLinks, mediaQuery, window, navigator, form, run, click, submit, scroll };
}

(async () => {
  const f = fixture(); f.run('app.js');
  for (const key of ['lisa','weekend','nova','gameday','safari','saas']) {
    const link = f.projects.find(link => link.dataset.project === key);
    assert((await f.click(link)).prevented); assert(f.dialog.open); assert.equal(f.document.body.style.overflow,'hidden');
    if (key === 'safari') { const video = f.ids['dialog-media'].querySelectorAll('video')[0]; assert(video.controls); await video.emit('error'); assert(f.ids['dialog-media'].querySelector('[data-media-error]')); }
    f.dialog.close(); assert.equal(f.document.body.style.overflow,'auto'); assert.equal(f.document.activeElement,link);
  }
  f.projects[0].dataset.project = '__proto__'; assert.equal((await f.click(f.projects[0])).prevented,undefined);
  for (const [filter,count] of [['brand',1],['campaign',2],['motion',3],['all',6]]) {
    await f.click(f.filters.find(button => button.dataset.filter === filter)); assert.equal(f.cards.filter(card => !card.hidden).length,count);
    assert.equal(f.filters.filter(button => button.attrs['aria-pressed'] === 'true').length,1);
  }
  await f.click(f.services[2]); assert.equal(f.ids['contact-service'].value,'Motion & video');
  await f.click(f.ids['copy-email']); assert.equal(f.navigator.copied,'kymfestus@gmail.com');
  await f.submit(); const draft = new URL(f.window.location.href); assert.equal(draft.protocol,'mailto:'); assert.equal(draft.searchParams.get('subject'),'Kym Gfx — Brand identity');
  f.form.values.service = '\r\nbcc:attacker@example.com'; f.form.values.message = '<img src=x onerror=alert(1)>\uD800'; await f.submit();
  const safe = new URL(f.window.location.href); assert(!safe.searchParams.get('subject').includes('bcc:')); assert(safe.searchParams.get('body').includes('<img')); assert(safe.searchParams.get('body').includes('\uFFFD')); assert(!f.window.location.href.includes('<img'));
  const before = f.window.location.href; f.form.values.message = '😀'.repeat(2500); await f.submit(); assert.equal(f.window.location.href,before); assert(f.ids['form-status'].textContent.includes('too long'));
  f.form.valid = false; await f.submit(); assert.equal(f.window.location.href,before);
  for (const option of [{unsupportedDialog:true},{failDialog:true}]) { const fallback=fixture(option); fallback.run('app.js'); assert.equal((await fallback.click(fallback.projects[0])).prevented,undefined); assert.equal(fallback.document.body.style.overflow,'auto'); await fallback.submit(); assert(fallback.window.location.href.startsWith('mailto:')); }
  const clipboardFallback = fixture({noClipboard:true}); clipboardFallback.run('app.js'); await clipboardFallback.click(clipboardFallback.ids['copy-email']); assert(clipboardFallback.ids['copy-status'].textContent.includes('unavailable'));

  const n = fixture(); n.run('navigation.js'); assert.equal(n.nav.inert,false);
  await n.scroll(100); assert.equal(n.nav.inert,true); await n.toggle.emit('pointerenter',{pointerType:'mouse'}); assert.equal(n.nav.inert,false); await n.click(n.toggle); assert(n.header.classes.has('is-open'));
  await n.document.emit('keydown',{key:'Escape',preventDefault(){}}); assert.equal(n.nav.inert,true); assert.equal(n.document.activeElement,n.toggle);
  await n.scroll(50); assert.equal(n.nav.inert,false); n.navLinks[0].focus(); await n.scroll(150); assert.equal(n.nav.inert,false);
  n.document.activeElement=n.document; n.mediaQuery.matches=true; await n.mediaQuery.emit('change'); assert.equal(n.nav.inert,true); await n.click(n.toggle); assert.equal(n.nav.inert,false); await n.click(n.navLinks[0]); assert.equal(n.nav.inert,true);
  await n.click(n.toggle); await n.document.emit('pointerdown',{target:n.document}); assert.equal(n.nav.inert,true);
  const legacy = fixture({mobile:true,legacyMedia:true}); legacy.run('navigation.js'); await legacy.click(legacy.toggle); assert.equal(legacy.nav.inert,false);
  const motion = require('./load-frontend.cjs')(path.join(dist,'motion.js'));
  assert.equal(motion.revealThreshold(1200,300,.5),.125); assert.equal(motion.revealThreshold(100,300,.5),.5); assert(motion.revealThreshold(2000,150,.5)>0);
  console.log('Site checks passed: 6 project dialogs; failed/unsupported dialogs; media errors; filters; service selection; clipboard fallbacks; encoded mailto input; header injection rejection; malformed Unicode; long/invalid briefs; responsive navigation; keyboard focus; legacy media queries; oversized reveals.');
})().catch(error => { console.error(error); process.exitCode=1; });
