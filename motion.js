(function (root, factory) {
  const motion = factory();
  if (typeof module === 'object' && module.exports) module.exports = motion;
  else motion.init(root);
})(globalThis, function () {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // LaunchFolio's published spring: stiffness 1000, damping 130, mass 1.
  // Solve the overdamped spring analytically so it behaves the same at any FPS.
  function springStep(position, velocity, target, seconds) {
    const discriminant = Math.sqrt(130 * 130 - 4 * 1000);
    const slow = (-130 + discriminant) / 2;
    const fast = (-130 - discriminant) / 2;
    const error = position - target;
    const a = (velocity - fast * error) / (slow - fast);
    const b = error - a;
    const nextA = a * Math.exp(slow * seconds);
    const nextB = b * Math.exp(fast * seconds);
    return { position: target + nextA + nextB, velocity: slow * nextA + fast * nextB };
  }

  function scrollProgress(scroll, heroTop, heroHeight) {
    return clamp((scroll - Math.max(0, heroTop - 1)) / Math.max(1, heroHeight));
  }

  function initialPose(image, scene, index, viewportWidth) {
    const scale = Math.min(viewportWidth >= 992 ? 0.7 : 0.6, scene.width * 0.88 / image.width);
    const xOffsets = [0, 54, -50, 4];
    const yOffsets = [0, 0, -22, 28];
    return {
      x: scene.left + scene.width * 0.5 + xOffsets[index] * scene.width / 520 - image.left - image.width / 2,
      y: scene.top + scene.height * 0.43 + yOffsets[index] * scene.height / 500 - image.top - image.height / 2,
      scale,
      rotate: [10, 15, -5, 5][index]
    };
  }

  function poseAt(pose, progress) {
    const remaining = 1 - clamp(progress);
    if (remaining === 0) return { x: 0, y: 0, scale: 1, rotate: 0 };
    return { x: pose.x * remaining, y: pose.y * remaining, scale: 1 + (pose.scale - 1) * remaining, rotate: pose.rotate * remaining };
  }

  function revealThreshold(elementHeight, viewportHeight, desired) {
    return Math.min(desired, 0.5 * Math.min(1, Math.max(1, viewportHeight) / Math.max(1, elementHeight)));
  }

  function init(win) {
    const doc = win.document;
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = win.matchMedia('(min-width: 768px)');
    const hero = doc.getElementById('home');
    const scene = doc.querySelector('.hero-art');
    const cards = Array.from(doc.querySelectorAll('.project-card')).slice(0, 4);
    if (!hero || !scene || cards.length !== 4) return;
    const pictures = cards.map(card => card.querySelector('.project-image'));
    const metas = cards.map(card => card.querySelector('.project-meta'));
    let poses = [];
    let enabled = false;
    let filtered = false;
    let frame = 0;
    let lastTime = 0;
    let position = 0;
    let velocity = 0;
    let target = 0;
    let heroTop = 0;
    let heroHeight = 1;
    let resizeFrame = 0;

    function clearScene() {
      win.cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      doc.documentElement.classList.remove('card-motion-enabled');
      pictures.forEach(image => { image.style.transform = ''; image.style.zIndex = ''; image.style.willChange = ''; image.style.setProperty('--card-detail-opacity', '1'); });
      metas.forEach(meta => { meta.style.opacity = ''; });
      enabled = false;
    }

    function draw() {
      pictures.forEach((image, index) => {
        const pose = poseAt(poses[index], position);
        image.style.transform = `perspective(1200px) translate3d(${pose.x.toFixed(3)}px, ${pose.y.toFixed(3)}px, 0) scale(${pose.scale.toFixed(5)}) rotate(${pose.rotate.toFixed(3)}deg)`;
        image.style.zIndex = position > 0.995 ? '1' : String([4, 1, 2, 3][index]);
        const details = clamp((position - 0.72) / 0.28);
        image.style.setProperty('--card-detail-opacity', details.toFixed(3));
        metas[index].style.opacity = details.toFixed(3);
      });
    }

    function tick(time) {
      frame = 0;
      if (!enabled || doc.hidden) { lastTime = 0; return; }
      const seconds = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = time;
      const next = springStep(position, velocity, target, seconds);
      position = next.position; velocity = next.velocity;
      if (Math.abs(position - target) < 0.00005 && Math.abs(velocity) < 0.0001) {
        position = target; velocity = 0; lastTime = 0; draw(); return;
      }
      draw(); frame = win.requestAnimationFrame(tick);
    }

    function onScroll() {
      if (!enabled) return;
      target = scrollProgress(win.scrollY, heroTop, heroHeight);
      if (!frame && (Math.abs(position - target) > 0.00005 || Math.abs(velocity) > 0.0001)) frame = win.requestAnimationFrame(tick);
    }

    function measure() {
      clearScene();
      if (reduced.matches || !desktop.matches || filtered || cards.some(card => card.hidden)) return;
      const stage = scene.getBoundingClientRect();
      if (!stage.width || !stage.height) return;
      poses = pictures.map((image, index) => initialPose(image.getBoundingClientRect(), stage, index, win.innerWidth));
      heroTop = hero.getBoundingClientRect().top + win.scrollY;
      heroHeight = hero.clientHeight;
      target = scrollProgress(win.scrollY, heroTop, heroHeight);
      position = target; velocity = 0;
      enabled = true;
      doc.documentElement.classList.add('card-motion-enabled');
      pictures.forEach(image => {
        image.style.willChange = 'transform';
        const img = image.querySelector('img'); if (img) img.loading = 'eager';
      });
      draw();
    }

    function scheduleMeasure() {
      win.cancelAnimationFrame(resizeFrame);
      resizeFrame = win.requestAnimationFrame(measure);
    }

    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', scheduleMeasure, { passive: true });
    win.addEventListener('pageshow', scheduleMeasure);
    function listenMedia(query, listener) {
      if (query.addEventListener) query.addEventListener('change', listener);
      else query.addListener(listener);
    }
    listenMedia(desktop, scheduleMeasure);
    listenMedia(reduced, scheduleMeasure);
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) { win.cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else onScroll();
    });
    doc.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      filtered = button.dataset.filter !== 'all'; scheduleMeasure();
    }));
    cards.forEach(card => card.querySelector('.project-link').addEventListener('focus', () => {
      // A keyboard user jumping to the projects gets stable, fully visible targets.
      if (enabled && card.querySelector('.project-link').matches(':focus-visible') && position < 0.95 && card.getBoundingClientRect().top < win.innerHeight) {
        filtered = true; clearScene();
      }
    }));
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(scheduleMeasure);
      observer.observe(hero); observer.observe(doc.querySelector('.project-grid'));
    }
    measure();
    if (doc.fonts) doc.fonts.ready.then(scheduleMeasure);

    // The reference reveals words from opacity .001, blur 5px and y 10px,
    // with 800ms duration, 50ms word stagger, and the Material easing curve.
    if (!win.IntersectionObserver || !win.Element.prototype.animate || reduced.matches) return;
    const pending = new Set();
    const animations = new Set();
    const observers = new Set();
    const revealJobs = new Map();
    function animate(element, frames, options) {
      element.style.opacity = '';
      const animation = element.animate(frames, { easing: EASING, fill: 'both', ...options });
      animations.add(animation);
      const finish = () => { animation.cancel(); animations.delete(animation); };
      if (animation.finished?.then) animation.finished.then(finish).catch(() => {});
      else win.setTimeout(finish, (options.duration || 0) + (options.delay || 0) + 50);
    }
    function prepare(element, play, threshold) {
      pending.add(element);
      const previous = revealJobs.get(element);
      if (previous) { previous.observer.disconnect(); observers.delete(previous.observer); }
      // A large heading at high zoom must still be able to enter the viewport.
      const adjusted = revealThreshold(element.getBoundingClientRect().height, win.innerHeight, threshold);
      const observer = new win.IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= adjusted)) {
          observer.disconnect(); observers.delete(observer); pending.delete(element); revealJobs.delete(element); play();
        }
      }, { threshold: adjusted });
      revealJobs.set(element, { play, threshold, observer });
      observers.add(observer); observer.observe(element);
    }
    win.addEventListener('resize', () => {
      // Snapshot before replacing entries so iteration cannot keep revisiting them.
      Array.from(revealJobs).forEach(([element, job]) => prepare(element, job.play, job.threshold));
    }, { passive: true });
    const revealFrames = [{ opacity: 0.001, filter: 'blur(5px)', transform: 'translateY(10px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' }];
    doc.querySelectorAll('.hero h1, .section h2, .contact-copy h2').forEach(heading => {
      const walker = doc.createTreeWalker(heading, win.NodeFilter.SHOW_TEXT);
      const nodes = []; let node;
      while ((node = walker.nextNode())) nodes.push(node);
      const words = [];
      nodes.forEach(text => {
        const fragment = doc.createDocumentFragment();
        text.textContent.split(/(\s+)/).forEach(token => {
          if (!token) return;
          if (/^\s+$/.test(token)) fragment.appendChild(doc.createTextNode(token));
          else { const word = doc.createElement('span'); word.className = 'motion-word'; word.textContent = token; word.style.opacity = '0.001'; fragment.appendChild(word); words.push(word); }
        });
        text.replaceWith(fragment);
      });
      heading.dataset.motionWords = 'true';
      prepare(heading, () => words.forEach((word, index) => animate(word, revealFrames, { duration: 800, delay: (heading.tagName === 'H1' ? 200 : 0) + index * 50 })), 0.5);
    });
    [['.availability', 400, 600], ['.hero-actions', 400, 600], ['.hero-description', 850, 800], ['.hero-intro', 900, 800], ['.intro-strip', 600, 600]].forEach(([selector, delay, duration]) => {
      const element = doc.querySelector(selector); if (!element) return;
      element.style.opacity = '0.001';
      prepare(element, () => animate(element, selector === '.hero-description' || selector === '.hero-intro' ? revealFrames : [{ opacity: 0.001 }, { opacity: 1 }], { duration, delay }), 0.5);
    });
    doc.querySelectorAll('.service-item, .about-portrait, .about-copy>p, .process-grid>div, .faq-list details').forEach(element => {
      element.style.opacity = '0.001';
      prepare(element, () => animate(element, [{ opacity: 0.001, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: 0 }), 0.15);
    });
    listenMedia(reduced, () => {
      if (!reduced.matches) return;
      observers.forEach(observer => observer.disconnect());
      animations.forEach(animation => animation.cancel());
      pending.forEach(element => { element.style.opacity = ''; });
      doc.querySelectorAll('.motion-word').forEach(word => { word.style.opacity = ''; });
      pending.clear(); animations.clear(); observers.clear(); revealJobs.clear();
    });
  }
  return { springStep, scrollProgress, initialPose, poseAt, revealThreshold, init };
});
