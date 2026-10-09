'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const dist=process.env.KYM_TEST_DIST || path.join(__dirname,'..');
const load=require('./load-frontend.cjs');
const {draftFor,clean}=load(path.join(dist,'forms.js'));
const {springFrames}=load(path.join(dist,'hover.js'));
const now=new Date('2026-10-08T18:00:00Z');
const request={name:'Jane Client',email:'jane@example.com',message:'I need a brand identity.',platform:'Google Meet',date:'2026-10-09',time:'10:00',timezone:'Africa/Nairobi',project:'Client identity',role:'Founder',permission:'private'};
const data=values=>({get:key=>values[key]});
function draft(kind,changes={}) {return draftFor(kind,data({...request,...changes}),now);}
for(const platform of ['Google Meet','Zoom']) {
 const r=draft('booking',{platform});assert(r.url);const url=new URL(r.url);
 assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'kymfestus@gmail.com');
 assert(url.searchParams.get('body').includes('Timezone: Africa/Nairobi'));assert(url.searchParams.get('body').includes('not a confirmed booking'));
}
for(const bad of [{platform:'javascript:alert(1)'},{timezone:'Bad/Zone'},{date:'2026-02-30'},{date:'2026-10-08',time:'20:59'},{time:'24:15'},{email:'evil\r\nbcc:attack@example.com'},{name:'  '},{message:''}]) assert(draft('booking',bad).error,JSON.stringify(bad));
assert(draft('booking',{date:'2026-10-08',time:'14:01',timezone:'America/New_York'}).url,'Future time in the selected timezone');
for(const permission of ['private','public']) {
 const r=draft('feedback',{permission});assert(r.url);const body=new URL(r.url).searchParams.get('body');
 assert(body.includes(permission==='private'?'Do not publish it':'Keep my email private'));
}
assert(draft('feedback',{permission:'yes'}).error);assert(draft('feedback',{project:''}).error);
const malicious=draft('feedback',{message:'<script>alert(1)</script>\uD800\r\nbody=other',role:'CEO\r\nbcc:evil@example.com'});
assert(malicious.url);assert(!malicious.url.includes('<script'));assert(new URL(malicious.url).searchParams.get('body').includes('\uFFFD'));
assert(!new URL(malicious.url).searchParams.has('bcc'));
assert(draft('contact',{message:'😀'.repeat(2500)}).error);
const subject=new URL(draft('contact',{service:'\r\nbcc:evil@example.com'}).url).searchParams.get('subject');assert.equal(subject,'Kym Gfx — Let’s discuss a project');
assert(draft('unknown').error);assert.equal(clean('\u0000safe\u007f',50),'safe');
for(const bounce of [.2,.4]){const frames=springFrames(400,bounce);assert(frames.every(f=>Number.isFinite(f.value)));assert.equal(frames[0].value,0);assert.equal(frames.at(-1).value,1);assert(Math.max(...frames.map(f=>f.value))>1);}
// Missing email-app support retains all text and reports the failure.
const listeners={},status={textContent:''},form={dataset:{formKind:'feedback'},querySelector:()=>status,reportValidity:()=>true,addEventListener:(key,fn)=>{listeners[key]=fn;}};
const win={document:{querySelectorAll:()=>[form]},FormData:class {get(key){return request[key];}},location:{set href(v){throw Error('No mail handler');}}};
load(path.join(dist,'forms.js')).init(win);listeners.submit({preventDefault(){}});assert(status.textContent.includes('text is still here'));
console.log('Form checks passed: Meet/Zoom requests, timezone-aware future dates, invalid dates/platforms, malformed Unicode, encoding, header injection, permission allowlist, long briefs, missing email-app fallback, and hover spring endpoints.');
