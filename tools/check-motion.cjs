const assert = require('node:assert/strict');
const { springStep, scrollProgress, initialPose, poseAt } = require('./load-frontend.cjs')(require('node:path').join(__dirname,'../motion.js'));

function settle(fps, target, start = 0, initialVelocity = 0, seconds = 2) {
  let state = { position: start, velocity: initialVelocity };
  for (let i = 0; i < fps * seconds; i++) state = springStep(state.position, state.velocity, target, 1 / fps);
  return state;
}

// The same scroll input must not produce different motion on 30/60/120Hz displays.
const samples = [30, 60, 120].map(fps => settle(fps, 1));
for (const state of samples) {
  assert(Math.abs(state.position - 1) < 1e-6);
  assert(Math.abs(state.velocity) < 1e-5);
  assert(Math.abs(state.position - samples[0].position) < 1e-12);
}
const reverse = settle(60, 0, 0.8, 2);
assert(Math.abs(reverse.position) < 1e-6, 'Scroll reversal must return to the hero stack');
assert.equal(scrollProgress(-100, 88, 670), 0);
assert.equal(scrollProgress(87, 88, 670), 0);
assert.equal(scrollProgress(757, 88, 670), 1);
assert.equal(scrollProgress(2000, 88, 670), 1);

// Start in the hero and finish exactly at the natural grid position at both widths.
for (const viewportWidth of [939, 1440]) {
  const scene = { left: 540, top: 170, width: viewportWidth === 939 ? 330 : 570, height: 440 };
  const image = { left: 36, top: 1300, width: viewportWidth === 939 ? 419 : 590, height: 400 };
  for (let index = 0; index < 4; index++) {
    const initial = initialPose(image, scene, index, viewportWidth);
    const center = { x: image.left + image.width / 2 + initial.x, y: image.top + image.height / 2 + initial.y };
    assert(center.x > scene.left && center.x < scene.left + scene.width);
    assert(center.y > scene.top && center.y < scene.top + scene.height);
    assert(initial.scale > 0 && initial.scale <= (viewportWidth >= 992 ? .7 : .6));
    assert.deepEqual({...poseAt(initial, 1)}, { x: 0, y: 0, scale: 1, rotate: 0 });
    assert.deepEqual({...poseAt(initial, 5)}, { x: 0, y: 0, scale: 1, rotate: 0 });
    const halfway = poseAt(initial, .5);
    assert(halfway.scale > initial.scale && halfway.scale < 1);
  }
}
console.log('Motion checks passed: frame rates, reversal, scroll bounds, and hero-to-grid endpoints.');
