import './style.css';
import { LANDMARKS, formatCoords } from './landmarks.js';
import { BODIES } from './bodies.js';

const $ = (id) => document.getElementById(id);
const els = {
  scene: $('scene'),
  markers: $('markers'),
  fallback: $('fallback'),
  loader: $('loader'),
  list: $('landmark-list'),
  bodyList: $('body-list'),
  panelToggle: $('panel-toggle'),
  panelHeading: $('landmarks-heading'),
  card: $('info-card'),
  cardClose: $('info-close'),
  cardKicker: $('info-kicker'),
  cardTitle: $('info-title'),
  cardCoords: $('info-coords'),
  cardBody: $('info-body'),
  cardFacts: $('info-facts'),
  cardNote: $('info-note'),
  zoomIn: $('zoom-in'),
  zoomOut: $('zoom-out'),
  autoRotate: $('auto-rotate'),
  reset: $('reset-view'),
  explore: $('explore-solar'),
  returnMoon: $('return-moon'),
  scaleNote: $('scale-note'),
  tagline: $('tagline'),
  hint: $('hint'),
  live: $('live'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.matchMedia('(max-width: 720px)').matches;

const MOON_SCENE_LABEL = els.scene.getAttribute('aria-label');
const SOLAR_SCENE_LABEL =
  'Interactive solar system overview, not to scale. Drag to rotate, scroll or pinch to zoom. Choose a planet from the Solar System list to fly to it.';

let viewer = null; // set once WebGL initialises
let lastFocus = null;

// ---------- Lists (work with or without WebGL) ----------

function makeListButton(id, name, kind, color, onClick) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'landmark-btn';
  btn.dataset.id = id;
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="lm-name"></span><span class="lm-kind"></span>`;
  btn.querySelector('.lm-name').textContent = name;
  btn.querySelector('.lm-kind').textContent = kind;
  if (color) btn.style.setProperty('--pin-color', color);
  btn.addEventListener('click', onClick);
  li.appendChild(btn);
  return li;
}

function buildLists() {
  for (const lm of LANDMARKS) {
    els.list.appendChild(makeListButton(lm.id, lm.name, lm.kind.split(' · ')[0], null, () => selectLandmark(lm.id, { fly: true })));
  }
  for (const b of BODIES) {
    els.bodyList.appendChild(makeListButton(b.id, b.name, b.kind.split(' · ')[0], b.color, () => selectBody(b.id)));
  }
  els.bodyList.appendChild(makeListButton('moon', 'Back to the Moon', 'Return', '#d9dce4', () => viewer?.returnToMoon()));

  if (isSmallScreen()) setPanelOpen(false);
  els.panelToggle.addEventListener('click', () => setPanelOpen(els.panelToggle.getAttribute('aria-expanded') !== 'true'));
}

function setPanelOpen(open) {
  els.panelToggle.setAttribute('aria-expanded', String(open));
  const solar = document.body.classList.contains('solar');
  els.list.hidden = !open || solar;
  els.bodyList.hidden = !open || !solar;
}

// ---------- Info card ----------

function showCard({ id, kicker, title, sub, body, facts, note }) {
  lastFocus = document.activeElement;
  els.cardKicker.textContent = kicker;
  els.cardTitle.textContent = title;
  els.cardCoords.textContent = sub;
  els.cardBody.textContent = body;
  els.cardFacts.replaceChildren(
    ...facts.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
  els.cardNote.hidden = !note;
  els.card.hidden = false;
  document.body.classList.add('card-open');
  // On phones the card is a bottom sheet: nudge the 3D view up so the subject stays visible.
  if (isSmallScreen()) viewer?.setFrameShift(Math.min(0.24, (els.card.offsetHeight / window.innerHeight) * 0.5));
  markActive(id);
  if (isSmallScreen()) setPanelOpen(false);
  els.cardClose.focus({ preventScroll: true });
}

function markActive(id) {
  document.querySelectorAll('[data-id]').forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('active', on);
  });
}

function selectLandmark(id, { fly = false } = {}) {
  const lm = LANDMARKS.find((l) => l.id === id);
  if (!lm) return;
  showCard({ id, kicker: lm.kind, title: lm.name, sub: formatCoords(lm.lat, lm.lon), body: lm.body, facts: lm.facts });
  if (fly && viewer) viewer.flyToLandmark(lm);
  els.live.textContent = `${lm.name} selected.`;
}

function selectBody(id) {
  if (id === 'moon') {
    viewer?.returnToMoon();
    return;
  }
  const b = BODIES.find((x) => x.id === id);
  if (!b) return;
  showCard({ id, kicker: b.kind, title: b.name, sub: b.subtitle, body: b.body, facts: b.facts, note: true });
  viewer?.focusBody(id);
  els.live.textContent = `Flying to ${b.name}.`;
}

function closeCard() {
  if (els.card.hidden) return;
  els.card.hidden = true;
  document.body.classList.remove('card-open');
  viewer?.setFrameShift(0);
  markActive(null);
  if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus({ preventScroll: true });
}

els.cardClose.addEventListener('click', closeCard);

// ---------- Mode changes (Moon ↔ solar system) ----------

function onModeChange(mode) {
  const solarUi = mode === 'solar' || mode === 'to-solar';
  const transitioning = mode === 'to-solar' || mode === 'to-moon';
  const hadFocus = document.activeElement === els.explore || document.activeElement === els.returnMoon;
  document.body.classList.toggle('solar', solarUi);
  document.body.classList.toggle('transitioning', transitioning);
  els.explore.hidden = solarUi;
  els.returnMoon.hidden = !solarUi;
  els.scaleNote.hidden = !solarUi;
  els.panelHeading.textContent = solarUi ? 'Solar System' : 'Landmarks';
  els.tagline.textContent = solarUi ? 'Our solar system' : 'An interactive 3D Moon';
  els.scene.setAttribute('aria-label', solarUi ? SOLAR_SCENE_LABEL : MOON_SCENE_LABEL);
  els.reset.setAttribute('aria-label', solarUi ? 'Back to overview' : 'Reset view');
  els.reset.title = solarUi ? 'Back to overview (R)' : 'Reset view (R)';
  els.zoomIn.disabled = els.zoomOut.disabled = els.reset.disabled = els.autoRotate.disabled = transitioning;
  setPanelOpen(els.panelToggle.getAttribute('aria-expanded') === 'true');
  // Keep keyboard focus on the mode button that replaced the one you pressed.
  if (hadFocus) (solarUi ? els.returnMoon : els.explore).focus({ preventScroll: true });

  if (mode === 'to-solar') {
    closeCard();
    els.live.textContent = 'Pulling back from the Moon, past Earth, to the whole solar system. Not to scale.';
  } else if (mode === 'solar' && viewer?.focus === 'sun' && els.card.hidden) {
    els.live.textContent = 'Solar system overview, not to scale. Choose a planet from the Solar System list.';
  } else if (mode === 'to-moon') {
    closeCard();
    els.live.textContent = 'Returning to the Moon.';
  } else if (mode === 'moon') {
    els.live.textContent = 'Back at the Moon.';
  }
}

// ---------- WebGL detection & fallback ----------

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function showFallback(reason) {
  console.warn('[MoonClaw] Using fallback image:', reason);
  document.body.classList.add('no-webgl');
  els.fallback.hidden = false;
  els.scene.hidden = true;
  els.loader.hidden = true;
  document.querySelector('.controls').hidden = true;
  els.hint.hidden = true;
}

// ---------- Keyboard ----------

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCard();
    return;
  }
  if (!viewer || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
  // Arrow keys only rotate when the scene itself (or the page body) has focus,
  // so they don't hijack list navigation.
  const sceneFocused = t === els.scene || t === document.body;
  const step = e.shiftKey ? 0.35 : 0.12;
  switch (e.key) {
    case 'ArrowLeft':
      if (sceneFocused) { viewer.rotateBy(-step, 0); e.preventDefault(); }
      break;
    case 'ArrowRight':
      if (sceneFocused) { viewer.rotateBy(step, 0); e.preventDefault(); }
      break;
    case 'ArrowUp':
      if (sceneFocused) { viewer.rotateBy(0, -step); e.preventDefault(); }
      break;
    case 'ArrowDown':
      if (sceneFocused) { viewer.rotateBy(0, step); e.preventDefault(); }
      break;
    case '+':
    case '=':
      viewer.zoom(0.8);
      break;
    case '-':
    case '_':
      viewer.zoom(1.25);
      break;
    case 'r':
    case 'R':
      els.reset.click();
      break;
    case 'a':
    case 'A':
      els.autoRotate.click();
      break;
    case 's':
    case 'S':
      if (!els.explore.hidden) els.explore.click();
      break;
    case 'm':
    case 'M':
      if (!els.returnMoon.hidden) els.returnMoon.click();
      break;
  }
});

// ---------- Boot ----------

buildLists();

if (!hasWebGL()) {
  showFallback('WebGL not supported');
} else {
  import('./viewer.js')
    .then(({ createViewer }) =>
      createViewer({
        container: els.scene,
        markerLayer: els.markers,
        landmarks: LANDMARKS,
        reducedMotion,
        onSelect: (id) => selectLandmark(id, { fly: true }),
        onSelectBody: (id) => selectBody(id),
        onModeChange,
        onReady: () => {
          els.loader.hidden = true;
          document.body.classList.add('ready');
        },
        onInteract: () => document.body.classList.add('interacted'),
      }),
    )
    .then((v) => {
      viewer = v;
      window.moonclaw = v.debug; // read-only state for testing
      window.moonclawViewer = v;
      els.zoomIn.addEventListener('click', () => v.zoom(0.75));
      els.zoomOut.addEventListener('click', () => v.zoom(1.33));
      els.reset.addEventListener('click', () => {
        if (els.reset.disabled) return;
        v.reset();
        closeCard();
        els.live.textContent = v.mode === 'moon' ? 'View reset.' : 'Solar system overview.';
      });
      els.autoRotate.addEventListener('click', () => {
        const on = els.autoRotate.getAttribute('aria-pressed') !== 'true';
        els.autoRotate.setAttribute('aria-pressed', String(on));
        v.setAutoRotate(on);
        els.live.textContent = on ? 'Auto-rotate on.' : 'Auto-rotate off.';
      });
      els.explore.addEventListener('click', () => {
        els.autoRotate.setAttribute('aria-pressed', 'false');
        v.exploreSolarSystem();
      });
      els.returnMoon.addEventListener('click', () => {
        els.autoRotate.setAttribute('aria-pressed', 'false');
        v.returnToMoon();
      });
    })
    .catch((err) => showFallback(err));
}
