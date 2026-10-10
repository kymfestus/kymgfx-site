(() => {
  'use strict';
  const frames = Array.from(document.querySelectorAll('iframe[data-tally-id]'));
  if (!frames.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Pre-fill the service when a service card is chosen on the home page.
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
    const frame = frames.find(item => item.dataset.tallyId === 'VLRzQl');
    if (!frame) return;
    try {
      const url = new URL(frame.src);
      url.searchParams.set('service', link.dataset.service);
      if (frame.src !== url.toString()) frame.src = url.toString();
    } catch { /* The embedded form still works without a pre-filled service. */ }
  }));

  // When a form is submitted, bring its confirmation into view.
  window.addEventListener('message', event => {
    if (event.origin !== 'https://tally.so' || typeof event.data !== 'string') return;
    if (!event.data.includes('Tally.FormSubmitted')) return;
    const frame = frames.find(item => item.contentWindow === event.source);
    const card = frame && frame.closest('.tally-card');
    if (card) card.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
  });
})();
