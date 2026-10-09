(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('header-nav');
  const toggle = header?.querySelector('.menu-toggle');
  if (!header || !nav || !toggle) return;

  const mobile = window.matchMedia('(max-width: 767px)');
  let open = false;
  let openedByHover = false;
  let collapsed = window.scrollY > 32;
  let lastScroll = Math.max(0, window.scrollY);
  let scrollFrame = 0;

  function render() {
    const closed = (mobile.matches || collapsed) && !open;
    header.classList.toggle('is-collapsed', closed);
    header.classList.toggle('is-open', open);
    nav.inert = closed;
    nav.setAttribute('aria-hidden', String(closed));
    toggle.setAttribute('aria-expanded', String(!closed));
    toggle.setAttribute('aria-label', closed ? 'Open navigation' : 'Close navigation');
  }

  function close(returnFocus = false) {
    if (!open) return;
    open = false;
    openedByHover = false;
    render();
    if (returnFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => {
    // Clicking a menu just revealed by hover keeps it open.
    open = openedByHover || !open;
    openedByHover = false;
    render();
  });
  toggle.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || mobile.matches || !collapsed || open) return;
    open = true;
    openedByHover = true;
    render();
  });
  header.addEventListener('pointerleave', () => {
    if (!mobile.matches && open && !header.contains(document.activeElement)) close();
  });
  header.addEventListener('focusout', () => {
    queueMicrotask(() => {
      if (!mobile.matches && open && !header.contains(document.activeElement)) close();
    });
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close()));
  header.querySelector('.header-profile').addEventListener('click', () => close());
  document.addEventListener('pointerdown', event => {
    if (!header.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    }
  });

  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      const position = Math.max(0, window.scrollY);
      const delta = position - lastScroll;
      if (position <= 32) collapsed = false;
      else if (Math.abs(delta) > 4 && !open && !nav.contains(document.activeElement)) collapsed = delta > 0;
      if (Math.abs(delta) > 4 || position <= 32) lastScroll = position;
      render();
    });
  }, { passive: true });
  const onBreakpointChange = () => {
    open = false;
    openedByHover = false;
    render();
  };
  if (mobile.addEventListener) mobile.addEventListener('change', onBreakpointChange);
  else mobile.addListener(onBreakpointChange);

  toggle.hidden = false;
  document.documentElement.classList.add('navigation-ready');
  render();
})();
