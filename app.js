(() => {
  'use strict';
  const projects = {
    lisa: { title: 'LISA GTI', category: 'BRAND IDENTITY / BRAND GUIDELINES', description: 'A look at the LISA MK5 GTI visual identity: the logomark, brand pattern, and applications across apparel and automotive accessories.', tools: 'Illustrator / Photoshop', url: 'https://www.behance.net/gallery/255600777/LISA-GTI-BRAND-GUIDELINES', images: [{src:'lisa-car.webp',alt:'LISA MK5 GTI identity applied to a car photograph'},{src:'lisa-identity.webp',alt:'LISA GTI logomark and wordmark guidelines'},{src:'lisa-pattern.webp',alt:'Geometric LISA GTI brand pattern in black, blue, and red'},{src:'lisa-apparel.webp',alt:'LISA GTI identity on caps and apparel'},{src:'lisa-keyring.webp',alt:'LISA GTI keyring design'}] },
    weekend: { title: 'Weekend Frenzy', category: 'CAMPAIGN / EVENT POSTER', description: 'An electric blue nightlife visual, combining bold event typography with an energetic image treatment. Designed for an event campaign.', tools: 'Photoshop', url: 'https://www.behance.net/gallery/255861119/WEEKEND-FRENZY', images: [{src:'weekend-full.webp',alt:'Complete Weekend Frenzy event poster',poster:true}] },
    gameday: { title: 'Game Day: Eagles vs Titans', category: 'CAMPAIGN / EVENT POSTER', description: 'A sports event visual built around team colors, layered imagery, and a clear hierarchy for the game-day details.', tools: 'Photoshop', url: 'https://www.behance.net/gallery/256715563/GAME-DAY-EVENT-FLYER', images: [{src:'gameday-full.webp',alt:'Complete Game Day event flyer',poster:true}] },
    safari: { title: 'Safari', category: 'MOTION GRAPHICS / APP PRESENTATION', description: 'A motion project exploring the presentation of a digital product. Play the original project below, or view it on Behance.', tools: 'After Effects / Premiere Pro', url: 'https://www.behance.net/gallery/255861045/Safari-App-Motion-Graphics', video: 'safari.mp4', poster: 'safari-large.png' },
    nova: { title: 'Nova AI', category: 'MOTION GRAPHICS / SAAS EXPLAINER', description: 'A short product explainer combining a soft gradient visual style with motion. Watch the complete 15-second animation on Behance.', tools: 'After Effects / Premiere Pro', url: 'https://www.behance.net/gallery/255859293/Nova-AI-Saas-Video-Explainer', images: [{src:'nova-large.png',alt:'Nova AI video explainer preview'}], watch:true },
    saas: { title: 'SaaS App Explainer', category: 'MOTION / PRODUCT EXPLAINER', description: 'A digital product brought into a visual story. View the full motion project on Behance.', tools: 'Motion design', url: 'https://www.behance.net/gallery/255860675/Saas-App-Explainer', images: [{src:'saas.png',alt:'SaaS App Explainer project preview'}], watch:true }
  };
  const dialog = document.getElementById('project-dialog');
  const media = document.getElementById('dialog-media');
  let lastTrigger;
  let previousOverflow = '';
  const assetURL = filename => `assets/${filename}`;
  function mediaError() {
    if (!media || media.querySelector('[data-media-error]')) return;
    const message = document.createElement('p');
    message.dataset.mediaError = 'true';
    message.setAttribute('role', 'status');
    message.textContent = 'This preview couldn’t load. View the complete project on Behance below.';
    media.appendChild(message);
  }
  function openProject(key, trigger) {
    if (!Object.prototype.hasOwnProperty.call(projects, key)) return false;
    const project = projects[key];
    if (!dialog || !media || typeof dialog.showModal !== 'function') return false;
    lastTrigger = trigger || document.querySelector(`[data-project="${key}"]`);
    document.getElementById('dialog-title').textContent = project.title;
    document.getElementById('dialog-category').textContent = project.category;
    document.getElementById('dialog-description').textContent = project.description;
    document.getElementById('dialog-tools').textContent = project.tools;
    const link = document.getElementById('dialog-behance');
    link.href = project.url;
    document.getElementById('dialog-behance-label').textContent = project.watch ? 'Watch on Behance' : 'Full project on Behance';
    media.querySelectorAll('video').forEach(video => video.pause());
    media.replaceChildren();
    if (project.video) {
      const video = document.createElement('video');
      video.src = assetURL(project.video); video.poster = assetURL(project.poster);
      video.controls = true; video.playsInline = true; video.preload = 'metadata';
      video.setAttribute('aria-label', 'Safari app motion graphics');
      video.addEventListener('error', mediaError, { once: true });
      media.appendChild(video);
    } else {
      project.images.forEach(({src,alt,poster}, index) => {
        const img = document.createElement('img'); img.src = assetURL(src); img.alt = alt;
        img.addEventListener('error', mediaError, { once: true });
        if (index) img.loading = 'lazy'; if (poster) img.className = 'poster-detail';
        media.appendChild(img);
      });
    }
    if (!dialog.open) {
      try { dialog.showModal(); }
      catch { media.replaceChildren(); return false; }
      previousOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden'; dialog.scrollTop = 0;
    return true;
  }
  function closeProject() { if (dialog?.open && typeof dialog.close === 'function') dialog.close(); }
  document.querySelectorAll('[data-project]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (openProject(link.dataset.project, link)) event.preventDefault();
  }));
  document.querySelector('.dialog-close')?.addEventListener('click', closeProject);
  dialog?.addEventListener('click', event => { if (event.target === dialog) {const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeProject();} });
  dialog?.addEventListener('close', () => {
    media.querySelectorAll('video').forEach(video => video.pause());
    media.replaceChildren(); document.body.style.overflow = previousOverflow;
    if (lastTrigger?.isConnected) lastTrigger.focus({preventScroll:true});
  });
  const filters = document.querySelectorAll('[data-filter]');
  let selectedFilter='all';
  const updateProjects = () => {
    let count=0;
    document.querySelectorAll('.project-card').forEach(card=>{const show=selectedFilter==='all'||card.dataset.category===selectedFilter;card.hidden=!show;if(show)count++;});
    document.querySelectorAll('.fresh-work-intro').forEach(element=>{element.hidden=selectedFilter!=='all';});
    document.getElementById('project-count').textContent=`${String(count).padStart(2,'0')} ${count===1?'project':'projects'}`;
    const badge=Array.from(filters).find(button=>button.dataset.filter==='all')?.querySelector('span');
    if(badge)badge.textContent=String(document.querySelectorAll('.project-card').length).padStart(2,'0');
  };
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => {const active=filter===button;filter.classList.toggle('active',active);filter.setAttribute('aria-pressed',String(active));});
    selectedFilter=button.dataset.filter;updateProjects();
  }));
  window.addEventListener('portfolio-ready',updateProjects);
  const email = 'kymfestus@gmail.com';
  document.getElementById('copy-email')?.addEventListener('click', async () => {
    const label = document.getElementById('copy-email-label');
    try {await navigator.clipboard.writeText(email);label.textContent='Email copied';document.getElementById('copy-status').textContent='Email address copied to clipboard.';}
    catch {label.textContent='Select email to copy';document.getElementById('copy-status').textContent='Clipboard is unavailable. Select the email address above to copy it.';}
  });
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });
})();
