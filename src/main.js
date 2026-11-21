import './style.css';
import { LANDMARKS, formatCoords } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const els = {
  scene: $('scene'),
  markers: $('markers'),
  fallback: $('fallback'),
  loader: $('loader'),
  list: $('landmark-list'),
  panelToggle: $('panel-toggle'),
  card: $('info-card'),
  cardClose: $('info-close'),
  cardKicker: $('info-kicker'),
  cardTitle: $('info-title'),
  cardCoords: $('info-coords'),
  cardBody: $('info-body'),
  cardFacts: $('info-facts'),
  zoomIn: $('zoom-in'),
  zoomOut: $('zoom-out'),
  autoRotate: $('auto-rotate'),
  reset: $('reset-view'),
  hint: $('hint'),
  live: $('live'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.matchMedia('(max-width: 720px)').matches;

let viewer = null; // set once WebGL initialises
let activeId = null;
let lastFocus = null;

// ---------- Landmark list + info card (works with or without WebGL) ----------

function buildLandmarkList() {
  for (const lm of LANDMARKS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'landmark-btn';
    btn.dataset.id = lm.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="lm-name"></span><span class="lm-kind"></span>`;
    btn.querySelector('.lm-name').textContent = lm.name;
    btn.querySelector('.lm-kind').textContent = lm.kind.split(' · ')[0];
    btn.addEventListener('click', () => selectLandmark(lm.id, { fly: true }));
    li.appendChild(btn);
    els.list.appendChild(li);
  }

  if (isSmallScreen()) setPanelOpen(false);
  els.panelToggle.addEventListener('click', () =>
    setPanelOpen(els.panelToggle.getAttribute('aria-expanded') !== 'true'),
  );
}

function setPanelOpen(open) {
  els.panelToggle.setAttribute('aria-expanded', String(open));
  els.list.hidden = !open;
}

function selectLandmark(id, { fly = false } = {}) {
  const lm = LANDMARKS.find((l) => l.id === id);
  if (!lm) return;
  activeId = id;
  lastFocus = document.activeElement;

  els.cardKicker.textContent = lm.kind;
  els.cardTitle.textContent = lm.name;
  els.cardCoords.textContent = formatCoords(lm.lat, lm.lon);
  els.cardBody.textContent = lm.body;
  els.cardFacts.replaceChildren(
    ...lm.facts.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
  els.card.hidden = false;
  document.body.classList.add('card-open');

  document.querySelectorAll('[data-id]').forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('active', on);
  });

  if (isSmallScreen()) setPanelOpen(false);
  if (fly && viewer) viewer.flyToLandmark(lm);
  els.live.textContent = `${lm.name} selected.`;
  els.cardClose.focus({ preventScroll: true });
}

function closeCard() {
  if (els.card.hidden) return;
  els.card.hidden = true;
  document.body.classList.remove('card-open');
  activeId = null;
  document.querySelectorAll('[data-id]').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.classList.remove('active');
  });
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

els.cardClose.addEventListener('click', closeCard);

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
  if (!viewer) return;
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
      if (!e.ctrlKey && !e.metaKey) viewer.reset();
      break;
    case 'a':
    case 'A':
      if (!e.ctrlKey && !e.metaKey) els.autoRotate.click();
      break;
  }
});

// ---------- Boot ----------

buildLandmarkList();

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
        onReady: () => {
          els.loader.hidden = true;
          document.body.classList.add('ready');
        },
        onInteract: () => document.body.classList.add('interacted'),
      }),
    )
    .then((v) => {
      viewer = v;
      window.moonclaw = v.debug; // exposes read-only state for testing
      els.zoomIn.addEventListener('click', () => v.zoom(0.75));
      els.zoomOut.addEventListener('click', () => v.zoom(1.33));
      els.reset.addEventListener('click', () => {
        v.reset();
        closeCard();
        els.live.textContent = 'View reset.';
      });
      els.autoRotate.addEventListener('click', () => {
        const on = els.autoRotate.getAttribute('aria-pressed') !== 'true';
        els.autoRotate.setAttribute('aria-pressed', String(on));
        v.setAutoRotate(on);
        els.live.textContent = on ? 'Auto-rotate on.' : 'Auto-rotate off.';
      });
    })
    .catch((err) => showFallback(err));
}
