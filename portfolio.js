(() => {
  'use strict';
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;
  const curated = new Set(Array.from(grid.querySelectorAll('a[data-project][href]'), link => link.href.match(/\/gallery\/(\d+)\//)?.[1]).filter(Boolean));
  const category = title => /motion|explainer|animation|video/i.test(title) ? 'motion' : /brand|identity|logo/i.test(title) ? 'brand' : /poster|flyer|game day|frenzy|campaign|event/i.test(title) ? 'campaign' : 'other';
  const labels = {motion: 'Motion graphics', brand: 'Brand identity', campaign: 'Poster & campaign design', other: 'Visual design'};
  const make = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  fetch('portfolio.json', {credentials: 'same-origin', cache: 'no-cache', signal: controller.signal, headers: {Accept: 'application/json'}}).then(response => {
    if (!response.ok) throw Error('Unavailable');
    return response.json();
  }).then(data => {
    if (data.profileUrl !== 'https://www.behance.net/kymgfx0' || !Array.isArray(data.projects) || data.projects.length > 24) return;
    const valid = p => {
      if (typeof p.id !== 'string' || typeof p.url !== 'string' || typeof p.cover !== 'string') return false;
      const link = /^https:\/\/www\.behance\.net\/gallery\/(\d{5,12})\/[a-zA-Z0-9_-]+$/.exec(p.url);
      const cover = /^assets\/behance\/(\d{5,12})-[a-f0-9]{16}\.(?:png|jpg|webp)$/.exec(p.cover);
      return link?.[1] === p.id && cover?.[1] === p.id && (p.displayTitle === undefined || (typeof p.displayTitle === 'string' && p.displayTitle.length <= 200 && !/[\u0000-\u001f\u007f]/.test(p.displayTitle))) && typeof p.title === 'string' && p.title.length > 0 && p.title.length <= 200 && !/[\u0000-\u001f\u007f]/.test(p.title) && Number.isSafeInteger(p.publishedOn) && p.publishedOn >= 946684800 && p.publishedOn <= 4102444800;
    };
    if (!data.projects.every(valid) || new Set(data.projects.map(p => p.id)).size !== data.projects.length) return;
    const projects = data.projects.filter(p => !curated.has(p.id)).sort((a, b) => b.publishedOn - a.publishedOn || Number(b.id) - Number(a.id)).slice(0, 3);
    // Preserve the pre-rendered cards on fetch/validation failure. Build safe nodes before replacement.
    const nodes = [];
    if (projects.length) {
      const intro = make('div', 'fresh-work-intro');
      intro.append(make('span', 'eyebrow', 'FRESH FROM BEHANCE'), make('h3', '', 'New ideas, just landed.'));
      nodes.push(intro);
    }
    projects.forEach(project => {
      const type = category(project.title), article = make('article', 'project-card fresh-project-card');
      article.dataset.category = type;
      const link = make('a', 'project-link'); link.href = project.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const shown = project.displayTitle || project.title;
      link.setAttribute('aria-label', shown + ': view full project on Behance');
      const picture = make('div', 'project-image image-live'), image = make('img');
      image.src = project.cover; image.alt = shown + ' by Kym Gfx'; image.width = 404; image.height = 316; image.loading = 'lazy';
      image.addEventListener('error', () => { image.hidden = true; picture.classList.add('cover-unavailable'); });
      picture.append(image, make('span', 'project-type', labels[type]), make('span', 'fresh-badge', 'Featured'));
      const meta = make('div', 'project-meta'), copy = make('div');
      copy.append(make('h3', '', shown), make('p', '', labels[type] + '. View the full project on Behance.'));
      meta.append(copy, make('span', 'project-number', 'NEW')); link.append(picture, meta); article.append(link); nodes.push(article);
    });
    grid.querySelectorAll('.fresh-work-intro, .fresh-project-card').forEach(node => node.remove());
    const anchor = Array.from(grid.children).filter(node => node.classList.contains('project-card'))[4] || null;
    nodes.forEach(node => grid.insertBefore(node, anchor));
    window.dispatchEvent(new CustomEvent('portfolio-ready'));
  }).catch(() => { /* The static curated and featured work remains usable. */ }).finally(() => clearTimeout(timeout));
})();
