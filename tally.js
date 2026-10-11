(() => {
  'use strict';
  const frames = Array.from(document.querySelectorAll('iframe[data-tally-id]'));
  if (!frames.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // When a form is submitted, bring its confirmation into view.
  window.addEventListener('message', event => {
    if (event.origin !== 'https://tally.so' || typeof event.data !== 'string') return;
    if (!event.data.includes('Tally.FormSubmitted')) return;
    const frame = frames.find(item => item.contentWindow === event.source);
    const card = frame && frame.closest('.tally-card');
    if (card) card.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
  });
})();
