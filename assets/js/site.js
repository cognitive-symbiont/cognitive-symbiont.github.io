// Cognitive Symbiont, website v4.
// Screen 1: the street plays; clicking her or the robot opens the lens on the moving picture.
// Screen 2: a transparent mask rises over the same video and outlines every human (red) and every robot (yellow).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const portrait = matchMedia('(max-aspect-ratio: 1/1)');
const NS = 'http://www.w3.org/2000/svg';
const FW = 1920, FH = 1080;

const stage = $('#stage'), hero = $('#hero'), outline = $('#outline'), frame = $('#frame');
const body = document.body;

// ---------- loader ----------
const readyTimer = setTimeout(markReady, 2200);
function markReady() { clearTimeout(readyTimer); body.dataset.state = 'ready'; }
['loadeddata', 'canplay', 'playing'].forEach(ev => hero.addEventListener(ev, () => setTimeout(markReady, 200), { once: true }));
hero.addEventListener('error', markReady, { once: true });
if (reduced) { hero.removeAttribute('autoplay'); hero.pause(); }

// ---------- tracks: device points and figure boxes over the loop, normalized to the frame ----------
// Until assets/data/tracks.json loads, a single pose from the first frame stands in.
let TR = null;
const POSE = {
  pts: { head: [.330, .262], glasses: [.352, .338], ear: [.289, .350], pendant: [.347, .520], band: [.408, .640],
         rHead: [.660, .330], rEye: [.668, .318], rCore: [.646, .512], rHand: [.592, .735] },
  box: { human: [.225, .245, .470, 1.0], robot: [.560, .255, .755, 1.0] }
};
fetch('assets/data/tracks.json').then(r => r.ok ? r.json() : null).then(j => { if (j) TR = j; }).catch(() => {});
function pt(k, t) {
  const a = TR && TR.pts[k];
  if (!a) return POSE.pts[k];
  const f = ((t * TR.fps) % a.length + a.length) % a.length, i = Math.floor(f), j = (i + 1) % a.length, u = f - i;
  return [lerp(a[i][0], a[j][0], u), lerp(a[i][1], a[j][1], u)];
}
function box(k, t) {
  const a = TR && TR.box[k];
  if (!a) return POSE.box[k];
  const f = ((t * TR.fps) % a.length + a.length) % a.length, i = Math.floor(f), j = (i + 1) % a.length, u = f - i;
  return a[i].map((v, n) => lerp(v, a[j][n], u));
}

// ---------- where object-fit:cover puts the 1920x1080 frame ----------
let G = { ox: 0, oy: 0, w: innerWidth, h: innerHeight };
function objectPos(el) {
  const op = getComputedStyle(el).objectPosition.split(' ');
  const f = v => (v || '50%').endsWith('%') ? parseFloat(v) / 100 : .5;
  return [f(op[0]), f(op[1])];
}
function placeFrame() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const [px, py] = objectPos(hero);
  const s = Math.max(W / FW, H / FH), w = FW * s, h = FH * s;
  G = { ox: (W - w) * px, oy: (H - h) * py, w, h };
  frame.style.left = G.ox + 'px'; frame.style.top = G.oy + 'px';
  frame.style.width = w + 'px'; frame.style.height = h + 'px';
}
const toStage = ([x, y]) => [G.ox + x * G.w, G.oy + y * G.h];

// ---------- lens drawing ----------
const svg = $('#lensSvg');
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.append(e); return e; };
const DEVICES = [
  { k: 'glasses', label: 'Glasses', role: 'sight', dy: -20 },
  { k: 'ear', label: 'Earpiece', role: 'voice', dy: 14 },
  { k: 'pendant', label: 'Pendant', role: 'scene', dy: 0 },
  { k: 'band', label: 'Band', role: 'body', dy: 0 }
];
const ROBOT = [
  { k: 'rEye', label: 'Cameras', role: 'its own senses', dy: -18 },
  { k: 'rCore', label: 'Core', role: 'memory, models, timing', dy: 0 },
  { k: 'rHand', label: 'Hands', role: 'its own actions', dy: 16, left: true }
];
const hThreads = $('#hThreads'), hNodes = $('#hNodes'), rThreads = $('#rThreads');
const H = {
  threads: DEVICES.map(() => el('path', {}, hThreads)),
  halos: DEVICES.map(() => el('circle', { class: 'halo', r: 13 }, hNodes)),
  dots: DEVICES.map(() => el('circle', { r: 3.6 }, hNodes)),
  back: $('#hBack'), pulse: $('#hPulse'), orb: $('#hOrb'), ring: $('#hRing')
};
const R = { threads: ROBOT.filter(d => d.k !== 'rCore').map(() => el('path', {}, rThreads)), core: $('#rCore'), ring: $('#rRing') };
const leader = el('path', { class: 'leader', fill: 'none', stroke: 'rgba(238,242,251,.35)', 'stroke-width': 1, 'stroke-dasharray': '2 6' }, svg);
const leaderDot = el('circle', { class: 'leader-dot', r: 3 }, svg);
const tagsBox = $('#tags');
const tags = [
  ...DEVICES.map(d => ({ k: d.k, dy: d.dy, cls: 'tag h', html: `<b>${d.label}</b> · ${d.role}` })),
  ...ROBOT.map(d => ({ k: d.k, dy: d.dy, cls: 'tag r robot' + (d.left ? '' : ' right'), html: `<b>${d.label}</b> · ${d.role}` }))
].map(t => { const d = document.createElement('div'); d.className = t.cls + ' t-' + t.k; d.innerHTML = t.html; d.style.setProperty('--dy', `calc(${t.dy} * var(--u))`); tagsBox.append(d); return { ...t, node: d }; });

let orbS = null;
const quad = (a, c, b) => `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`;
const qAt = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
const F = ([x, y]) => [x * FW, y * FH];

function drawLens(t, now) {
  const head = F(pt('head', t));
  const target = [head[0] + 22, head[1] - 128];
  orbS = orbS ? [lerp(orbS[0], target[0], .08), lerp(orbS[1], target[1], .08)] : target;
  const orb = [orbS[0] + Math.sin(now / 1300) * 5, orbS[1] + Math.cos(now / 1700) * 4];
  H.orb.setAttribute('transform', `translate(${orb[0]} ${orb[1]})`);
  DEVICES.forEach((d, i) => {
    const p = F(pt(d.k, t));
    H.halos[i].setAttribute('cx', p[0]); H.halos[i].setAttribute('cy', p[1]);
    H.dots[i].setAttribute('cx', p[0]); H.dots[i].setAttribute('cy', p[1]);
    const c = [Math.min(p[0], orb[0]) - 70 - i * 18, (p[1] + orb[1]) / 2];
    H.threads[i].setAttribute('d', quad(p, c, orb));
    if (d.k === 'ear') {
      const cb = [(p[0] + orb[0]) / 2 + 60, (p[1] + orb[1]) / 2];
      H.back.setAttribute('d', quad(orb, cb, p));
      const f = ((now / 1600) % 1);
      const q = qAt(orb, cb, p, f);
      H.pulse.setAttribute('cx', q[0]); H.pulse.setAttribute('cy', q[1]);
    }
  });
  const hb = box('human', t).map((v, n) => v * (n % 2 ? FH : FW));
  H.ring.setAttribute('cx', (hb[0] + hb[2]) / 2); H.ring.setAttribute('cy', hb[1] + (hb[3] - hb[1]) * .55);
  H.ring.setAttribute('rx', (hb[2] - hb[0]) * .62); H.ring.setAttribute('ry', (hb[3] - hb[1]) * .62);

  const core = F(pt('rCore', t));
  R.core.setAttribute('transform', `translate(${core[0]} ${core[1]})`);
  ROBOT.filter(d => d.k !== 'rCore').forEach((d, i) => {
    const p = F(pt(d.k, t));
    R.threads[i].setAttribute('d', quad(p, [(p[0] + core[0]) / 2 + 26, (p[1] + core[1]) / 2], core));
  });
  const rb = box('robot', t).map((v, n) => v * (n % 2 ? FH : FW));
  R.ring.setAttribute('cx', (rb[0] + rb[2]) / 2); R.ring.setAttribute('cy', rb[1] + (rb[3] - rb[1]) * .55);
  R.ring.setAttribute('rx', (rb[2] - rb[0]) * .5); R.ring.setAttribute('ry', (rb[3] - rb[1]) * .58);

  tags.forEach(g => {
    const p = pt(g.k, t);
    g.node.style.left = (p[0] * 100) + '%'; g.node.style.top = (p[1] * 100) + '%';
  });
  // leader from the subject to the near end of its card's title: her orb to "Cognitive Symbiont",
  // the top of the robot's head to the right of "AI as individual"
  const card = $(`.lens-card[data-for="${lensWho}"]`);
  if (card && lensWho && !portrait.matches) {
    const r = $('.lens-kicker span', card).getBoundingClientRect(), s = stage.getBoundingClientRect();
    const fx = x => ((x - s.left - G.ox) / G.w) * FW, fy = y => ((y - s.top - G.oy) / G.h) * FH;
    const ay = fy(r.top + r.height * .55);
    const from = lensWho === 'human' ? [orb[0] + 40, orb[1] - 10] : [(rb[0] + rb[2]) / 2 - 20, rb[1] - 14];
    const ax = from[0] > fx(r.right) ? fx(r.right) + 16 : fx(r.left) - 16;
    leader.setAttribute('d', quad(from, [lerp(from[0], ax, .55), Math.min(from[1], ay) - 10], [ax, ay]));
    leaderDot.setAttribute('cx', from[0]); leaderDot.setAttribute('cy', from[1]);
  }
}

// ---------- lens state ----------
let lensWho = '', lensT0 = 0, manualUntil = 0, manualStep = 0;
const lens = $('#lens');
const STEPS = { human: { n: 5, dur: 2.8 }, robot: { n: 3, dur: 3.4 } };
function openLens(who) {
  if (progress() > .03) return;
  lensWho = who; body.dataset.lens = who; lensT0 = performance.now(); manualUntil = 0;
  leader.style.opacity = leaderDot.style.opacity = 1;
  placeCards(); onScroll();
}
function closeLens() { lensWho = ''; body.dataset.lens = ''; leader.style.opacity = leaderDot.style.opacity = 0; onScroll(); }
$$('.hit').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openLens(b.dataset.who); }));
$$('.lens-switch [data-who]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openLens(b.dataset.who); }));
$('.lens-switch [data-close]').addEventListener('click', e => { e.stopPropagation(); closeLens(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeLens(); });
stage.addEventListener('click', e => { if (lensWho && !e.target.closest('.lens-card,.lens-switch,.hit')) closeLens(); });
$$('.lens-steps li').forEach(li => li.addEventListener('click', e => {
  e.stopPropagation(); manualStep = +li.dataset.step; manualUntil = performance.now() + 9000;
}));
function stepNow(now) {
  if (!lensWho) return 0;
  const S = STEPS[lensWho];
  if (now < manualUntil) return manualStep;
  return Math.floor((now - lensT0) / (S.dur * 1000)) % S.n;
}
let lastStep = -1, lastWho = '';
function applyStep(now) {
  const s = stepNow(now);
  lens.classList.toggle('paused', now < manualUntil);
  if (s === lastStep && lensWho === lastWho) return;
  lastStep = s; lastWho = lensWho;
  const g = lensWho === 'robot' ? $('#gRobot') : $('#gHuman');
  $('#gHuman').dataset.step = lensWho === 'human' ? s : '';
  $('#gRobot').dataset.step = lensWho === 'robot' ? s : '';
  body.dataset.rstep = lensWho === 'robot' ? s : '';
  $$(`.lens-card[data-for="${lensWho}"] li`).forEach(li => {
    li.classList.remove('on'); void li.offsetWidth;
    li.classList.toggle('on', +li.dataset.step === s);
  });
  lens.style.setProperty('--stepdur', (STEPS[lensWho] || STEPS.human).dur + 's');
}
// the cards sit on the frame, in the sky between the towers, clamped to the viewport
const CARD_AT = { human: [.415, .085], robot: [.40, .085] };
function placeCards() {
  if (portrait.matches) return;
  $$('.lens-card').forEach(c => {
    const [x, y] = toStage(CARD_AT[c.dataset.for]);
    const W = stage.clientWidth, cw = c.offsetWidth;
    c.style.left = clamp(x, 24, W - cw - 24) + 'px';
    c.style.top = Math.max(y, 70) + 'px';
  });
}

// ---------- hit areas follow the figures ----------
const hits = { human: $('#hitHuman'), robot: $('#hitRobot') };
function placeHits(t) {
  for (const k in hits) {
    const b = box(k, t);
    const s = hits[k].style;
    s.left = (b[0] * 100) + '%'; s.top = (b[1] * 100) + '%';
    s.width = ((b[2] - b[0]) * 100) + '%'; s.height = ((Math.min(b[3], 1) - b[1]) * 100) + '%';
  }
}

// ---------- scroll: the frontier mask (screen 2) ----------
const heroCopy = $('#heroCopy'), scrollCue = $('#scrollCue'), types = $('#types');
const typeH = $('.type.human'), typeR = $('.type.robot');
function progress() { return clamp(scrollY / innerHeight); }
let P = 0;
function onScroll() {
  const p = P = progress();
  stage.style.setProperty('--cut', ((1 - p) * 100).toFixed(3) + '%');
  stage.style.setProperty('--fo', Math.min(1, p * 25, (1 - p) * 25).toFixed(3));
  types.style.setProperty('--k', clamp((p - .55) / .35).toFixed(3));
  if (!lensWho) {
    stage.style.setProperty('--hc', (1 - clamp(p * 2.4)).toFixed(3));
    stage.style.setProperty('--hy', (-p * 60).toFixed(1) + 'px');
  }
  stage.style.setProperty('--sc', (1 - clamp(p * 6)).toFixed(3));
  typeH.classList.toggle('on', p > .32);
  typeR.classList.toggle('on', p > .42);
  if (p > .03 && lensWho) closeLens();
  frame.querySelectorAll('.hit').forEach(h => h.style.pointerEvents = p < .03 ? 'auto' : 'none');
  if (portrait.matches) stage.style.setProperty('--fx', (lensWho === 'robot' ? 68 : lerp(30, 50, p)).toFixed(2) + '%');
  // the outline pass only decodes while the mask is up
  if (p <= .001 && !outline.paused) outline.pause();
  // the street video rests once it is off screen
  const off = scrollY >= innerHeight * 1.98;
  if (off && !hero.paused) hero.pause();
  if (!off && hero.paused && !reduced) hero.play().catch(() => {});
}
addEventListener('scroll', onScroll, { passive: true });

// ---------- outline pass kept in step with the street ----------
let lastFix = 0, lastStart = 0;
function startOutline(now) {
  lastStart = now;
  try { outline.currentTime = hero.currentTime % (outline.duration || 1e9); } catch (e) {}
  outline.play().catch(() => {});
}
function syncOutline(now) {
  if (P > .001 && outline.paused && !hero.paused && outline.readyState >= 2 && now - lastStart > 600) startOutline(now);
  if (outline.paused || hero.paused || !outline.duration || now - lastFix < 400) return;
  const D = outline.duration;
  let d = hero.currentTime - outline.currentTime;
  if (d > D / 2) d -= D; if (d < -D / 2) d += D;
  if (Math.abs(d) > .045) { lastFix = now; try { outline.currentTime = (hero.currentTime + .02) % D; } catch (e) {} }
}

// ---------- one loop for everything that follows the video ----------
function tick(now) {
  placeFrame();
  const t = hero.currentTime || 0;
  if (P < .05) placeHits(t);
  if (lensWho || body.dataset.lens) { drawLens(t, now); applyStep(now); if (portrait.matches === false) placeCards(); }
  syncOutline(now);
  if (portrait.matches) {
    const v = $('#veil').style;
    const b = box(lensWho || 'human', t);
    const c = toStage([(b[0] + b[2]) / 2, (b[1] + .4)]);
    v.setProperty('--vx', c[0] + 'px'); v.setProperty('--vy', c[1] + 'px');
  } else if (lensWho) {
    const b = box(lensWho, t), c = toStage([(b[0] + b[2]) / 2, b[1] + (Math.min(b[3], 1) - b[1]) * .45]);
    stage.style.setProperty('--vx', c[0] + 'px'); stage.style.setProperty('--vy', c[1] + 'px');
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
// a slow timer catches a missed scroll event and keeps the outline pass started and in step where rAF is throttled
let lastY = -1;
setInterval(() => {
  if (scrollY !== lastY) { lastY = scrollY; onScroll(); settlePanels(); }
  syncOutline(performance.now());
}, 500);

// ---------- six cases: play only the panel in view, load one screen ahead ----------
const panels = $$('.panel');
function loadPanel(p) {
  const v = $('video', p);
  if (v.dataset.loaded) return;
  $$('source', v).forEach(s => { s.src = s.dataset.src; });
  v.preload = 'auto'; v.load(); v.dataset.loaded = '1';
}
// visibility is computed from scroll position (also on scrollend and resize), with an observer as a second trigger
function settlePanels() {
  const vh = innerHeight;
  panels.forEach(p => {
    const r = p.getBoundingClientRect(), v = $('video', p);
    if (r.top < vh * 2.2 && r.bottom > -vh) loadPanel(p);
    const ratio = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / vh;
    const on = ratio >= .55;
    if (on === p.classList.contains('in')) { if (on && v.paused && !reduced && !p.classList.contains('dip')) v.play().catch(() => {}); return; }
    p.classList.toggle('in', on);
    if (on) { if (!reduced) v.play().catch(() => v.addEventListener('canplay', () => p.classList.contains('in') && v.play().catch(() => {}), { once: true })); }
    else v.pause();
  });
}
addEventListener('scroll', settlePanels, { passive: true });
addEventListener('scrollend', settlePanels);
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(settlePanels, { threshold: [0, .55, 1] }); panels.forEach(p => io.observe(p)); }
// a clip that tells a story plays through, dips to dark, and starts again
$$('video[data-once]').forEach(v => v.addEventListener('ended', () => {
  const p = v.closest('.panel'); p.classList.add('dip');
  setTimeout(() => { v.currentTime = 0; if (p.classList.contains('in')) v.play().catch(() => {}); p.classList.remove('dip'); }, 620);
}));
// each panel's cues live on the clip's own frame, wherever object-fit puts it
$$('.cue[data-nx]').forEach(c => { c.style.setProperty('--nx', c.dataset.nx); c.style.setProperty('--ny', c.dataset.ny); });
function placeCues() {
  panels.forEach(p => {
    const v = $('video', p), f = $('.pframe', p);
    const W = p.clientWidth, Hh = p.clientHeight, [px, py] = objectPos(v);
    const s = Math.max(W / FW, Hh / FH), w = FW * s, h = FH * s;
    Object.assign(f.style, { left: (W - w) * px + 'px', top: (Hh - h) * py + 'px', width: w + 'px', height: h + 'px' });
  });
}
// the card's beats and the cues on the picture follow the clip's own clock
const timed = panels.map(p => ({
  p, v: $('video', p), card: $('.case', p),
  beats: $$('.beats li', p).map(li => ({ li, t: +li.dataset.t })),
  cues: $$('[data-from]', p).map(e => ({ e, a: +e.dataset.from, b: e.dataset.to ? +e.dataset.to : 1e9 })),
  last: -1
}));
function syncCases() {
  timed.forEach(T => {
    if (!T.p.classList.contains('in')) return;
    const t = T.v.currentTime || 0, D = T.v.duration || 8;
    let i = 0; T.beats.forEach((b, n) => { if (t >= b.t) i = n; });
    if (T.p.classList.contains('dip')) i = -1;
    if (i !== T.last) {
      T.last = i; T.card.dataset.beat = i;
      T.beats.forEach((b, n) => {
        b.li.classList.remove('on'); void b.li.offsetWidth;
        if (n === i) { b.li.style.setProperty('--bd', Math.max(.4, ((T.beats[n + 1] || { t: D }).t - b.t)) + 's'); b.li.classList.add('on'); }
      });
    }
    T.cues.forEach(c => c.e.classList.toggle('on', t >= c.a && t < c.b && !T.p.classList.contains('dip')));
    // on a phone the crop follows the action (the handshake pans from her to the meeting point)
    if (T.p.dataset.pan) { T.p.classList.toggle('late', t >= +T.p.dataset.pan && !T.p.classList.contains('dip')); if (portrait.matches) placeCues(); }
  });
}
(function caseLoop() { syncCases(); requestAnimationFrame(caseLoop); })();
setInterval(syncCases, 250);

// ---------- the loop: one stage at a time, or the one the reader points at ----------
const stages = $$('.stages li');
let stageAt = 0, stageHold = 0;
function showStage(i) { stages.forEach((li, n) => li.classList.toggle('on', n === i)); stageAt = i; }
stages.forEach((li, n) => {
  li.addEventListener('mouseenter', () => { stageHold = performance.now() + 6000; showStage(n); });
  li.addEventListener('click', () => { stageHold = performance.now() + 9000; showStage(n); });
});
showStage(0);
setInterval(() => { if (performance.now() > stageHold) showStage((stageAt + 1) % stages.length); }, 2800);

// ---------- layout ----------
function layout() { placeFrame(); placeCards(); placeCues(); onScroll(); settlePanels(); }
addEventListener('resize', layout);
portrait.addEventListener('change', layout);
hero.addEventListener('loadedmetadata', layout);
layout();
