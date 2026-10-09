(function (root, factory) {
  'use strict';
  const forms = factory();
  if (typeof module === 'object' && module.exports) module.exports = forms;
  else forms.init(root);
})(globalThis, function () {
  'use strict';
  const email = 'kymfestus@gmail.com';
  const services = ['Let’s discuss a project', 'Brand identity', 'Poster design', 'Social campaigns', 'Motion graphics', 'Web design', 'Video editing', 'Social & event campaigns', 'Motion & video', 'Website design', 'Ongoing design support', 'Remote job opportunity'];
  const clean = (value, limit) => Array.from(String(value || '').slice(0, limit), c => /^[\uD800-\uDFFF]$/.test(c) ? '\uFFFD' : c).join('').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  const line = (value, limit) => clean(value, limit).replace(/[\r\n]/g, ' ');
  function dateParts(now, zone) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const p = Object.fromEntries(parts.map(part => [part.type,part.value]));
    return { date:`${p.year}-${p.month}-${p.day}`, time:`${p.hour}:${p.minute}` };
  }
  function draftFor(kind, data, now = new Date()) {
    const name = line(data.get('name'),100), reply = line(data.get('email'),160);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply)) return {error:'Please add your name and a valid email address.'};
    const message = clean(data.get('message'),kind === 'contact' ? 5000 : 2000);
    if (!message) return {error:'Please add a few details before opening your email draft.'};
    let subject, extra, summary;
    if (kind === 'contact') {
      const service = services.includes(data.get('service')) ? data.get('service') : services[0];
      subject = `Kym Gfx — ${service}`; extra = `Interested in: ${service}`;
    } else if (kind === 'booking') {
      const platform = data.get('platform'), date = data.get('date'), time = data.get('time'), zone = line(data.get('timezone'),80);
      if (!['Google Meet','Zoom'].includes(platform)) return {error:'Choose Google Meet or Zoom for your call.'};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '') || Number(time.slice(0,2)) > 23 || Number(time.slice(3)) > 59) return {error:'Choose a valid date and time.'};
      const calendarDate = new Date(date+'T12:00:00Z');
      if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0,10) !== date) return {error:'Choose a valid calendar date.'};
      let current;
      try { current = dateParts(now,zone); } catch { return {error:'Use an IANA timezone, such as Africa/Nairobi, Europe/London or America/New_York.'}; }
      if (date+'T'+time <= current.date+'T'+current.time) return {error:'Choose a future date and time in your selected timezone.'};
      subject = 'Kym Gfx — Discovery call request';
      extra = `Meeting platform: ${platform}\nPreferred date: ${date}\nPreferred time: ${time}\nTimezone: ${zone}\n\nPlease confirm availability and send a meeting link. This is a request, not a confirmed booking.`;
      summary = {Name:name,Email:reply,Platform:platform,'Preferred date':date,'Preferred time':time,Timezone:zone,'Your idea':message};
    } else if (kind === 'feedback') {
      const project = line(data.get('project'),160), permission = data.get('permission');
      if (!project) return {error:'Please add the project or business we worked on.'};
      if (!['private','public'].includes(permission)) return {error:'Choose whether your feedback stays private or may be published.'};
      subject = 'Kym Gfx — Client feedback';
      extra = `Project / business: ${project}\nRole: ${line(data.get('role'),100) || 'Not provided'}\nPublication permission: ${permission === 'public' ? 'You may publish my feedback with my name, role and project. Keep my email private.' : 'Keep this feedback private. Do not publish it.'}`;
    } else return {error:'Please email kymfestus@gmail.com directly.'};
    const body = `Hi Kym,\n\n${message}\n\nName: ${name}\nEmail: ${reply}\n${extra}`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (url.length > 8000) return {error:'Your brief is too long for some email apps. Please shorten it or email kymfestus@gmail.com directly. Your text is still here.'};
    return {url,summary};
  }
  function init(win) {
    const doc = win.document;
    doc.querySelectorAll('.email-form').forEach(form => {
      const status = form.querySelector('[data-form-status]');
      if (!status) return;
      if (form.dataset.formKind === 'booking') {
        const zone = form.querySelector('[name="timezone"]');
        try { zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi'; } catch { zone.value = 'Africa/Nairobi'; }
        const date = form.querySelector('[name="date"]');
        const setMinimum = () => {try {date.min=dateParts(new Date(),zone.value).date;}catch{date.min='';}};
        setMinimum();zone.addEventListener?.('change',setMinimum);
      }
      const review = form.dataset.review === 'true' ? form.querySelector('[data-booking-review]') : null;
      const send = review ? form.querySelector('[data-booking-send]') : null;
      const invalidate = () => {if(review){review.hidden=true;send.removeAttribute('href');status.textContent='';}};
      if(review) {
        form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
        form.querySelector('[data-booking-edit]').addEventListener('click',()=>{invalidate();form.querySelector('[name="name"]').focus();});
        send.addEventListener('click',event=>{
          const result=draftFor('booking',new win.FormData(form));
          if(result.error){event.preventDefault();invalidate();status.textContent=result.error;return;}
          send.href=result.url;
          status.textContent='Send the draft from your email app. I’ll reply to confirm availability and share your meeting link. Your details are still here.';
        });
      }
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const result = draftFor(form.dataset.formKind,new win.FormData(form));
        if (result.error) { status.textContent = result.error; return; }
        if(review) {
          const list=form.querySelector('[data-booking-summary]');list.replaceChildren();
          Object.entries(result.summary).forEach(([label,value])=>{
            const term=doc.createElement('dt'),detail=doc.createElement('dd');term.textContent=label;detail.textContent=value;list.append(term,detail);
          });
          send.href=result.url;review.hidden=false;review.focus();
          status.textContent='Review your request, then open and send the email draft. Your preferred time has not been reserved.';
          return;
        }
        try {
          win.location.href = result.url;
          status.textContent = 'Your email draft is ready. Send it from your email app to complete the request. If it doesn’t open, email kymfestus@gmail.com directly. Your text is still here.';
        } catch { status.textContent = 'Your email app could not be opened. Please email kymfestus@gmail.com directly. Your text is still here.'; }
      });
    });
  }
  return {clean,line,dateParts,draftFor,init};
});
