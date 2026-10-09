const assert=require('node:assert/strict');
const forms=require('./load-frontend.cjs')(require('node:path').join(__dirname,'../forms.js'));
class Element {
 constructor(){this.listeners={};this.hidden=true;this.children=[];this.textContent='';this.attrs={};}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 emit(name,event={preventDefault(){this.prevented=true;}}){for(const fn of this.listeners[name]||[])fn(event);return event;}
 replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}focus(){this.focused=true;}
 removeAttribute(name){delete this.attrs[name];if(name==='href')this.href='';}
}
const form=new Element(),status=new Element(),review=new Element(),summary=new Element(),send=new Element(),edit=new Element(),name=new Element(),zone=new Element(),date=new Element();
form.dataset={formKind:'booking',review:'true'};form.reportValidity=()=>true;
const nodes={'[data-form-status]':status,'[data-booking-review]':review,'[data-booking-summary]':summary,'[data-booking-send]':send,'[data-booking-edit]':edit,'[name="name"]':name,'[name="timezone"]':zone,'[name="date"]':date};
form.querySelector=selector=>nodes[selector];
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
const values={name:'<script>Jane</script>',email:'client@example.com',message:'A new website.',platform:'Google Meet',date:tomorrow,time:'10:00',timezone:'Africa/Nairobi'};
let navigation=0;
const win={document:{querySelectorAll:()=>[form],createElement:()=>new Element()},FormData:class{get(key){return values[key];}},location:{set href(url){navigation++;}}};
forms.init(win);form.emit('submit');assert.equal(navigation,0);assert.equal(review.hidden,false);assert(review.focused);assert.equal(summary.children[1].textContent,values.name);assert(send.href.startsWith('mailto:kymfestus@gmail.com'));assert.equal(new URL(send.href).searchParams.get('subject'),'Kym Gfx — Discovery call request');
values.platform='Zoom';form.emit('change');assert(review.hidden);assert.equal(send.href,'');form.emit('submit');assert(new URL(send.href).searchParams.get('body').includes('Meeting platform: Zoom'));
send.emit('click');assert(status.textContent.includes('confirm availability'));
edit.emit('click');assert(review.hidden);assert(name.focused);
form.emit('submit');values.platform='Unexpected';const event=send.emit('click');assert(event.prevented);assert(review.hidden);assert(status.textContent.includes('Choose Google Meet or Zoom'));assert.equal(navigation,0);
console.log('Booking review checks passed: review before email, safe text rendering, Meet/Zoom changes, edit/focus, stale-review invalidation and final revalidation.');
