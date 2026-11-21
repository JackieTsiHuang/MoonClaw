import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSolarSystem } from './solar.js';

const MOON_RADIUS = 1;
const MOON_MAX_DIST = 9;
const ORIGIN = new THREE.Vector3();
const DEFAULT_DIR = new THREE.Vector3(0, 0, 1);

/** Selenographic lat/lon (deg) → point on a unit sphere in the Moon's local frame.
 *  Matches three.js SphereGeometry UVs with an equirectangular map whose centre is 0° lon. */
function latLonToVector(lat, lon, r = MOON_RADIUS) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export async function createViewer({
  container, markerLayer, landmarks, reducedMotion,
  onSelect, onSelectBody, onModeChange, onReady, onInteract,
}) {
  const params = new URLSearchParams(location.search);
  const lite = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches || params.get('quality') === 'lite';

  // ---------- Renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x020308, 1);
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40000);
  scene.add(camera);

  // "Moon light" rides with the camera so whichever face you look at is lit, angled from the
  // upper-left to rake across crater relief. It hands over to the Sun as you leave the Moon.
  const camLight = new THREE.DirectionalLight(0xfff6e8, 3.0);
  camLight.position.set(-2.4, 1.5, 1.3);
  camera.add(camLight);
  camera.add(camLight.target);
  camLight.target.position.set(0, 0, -4);
  const ambient = new THREE.AmbientLight(0x8090b0, 0.18);
  scene.add(ambient);

  // ---------- Moon ----------
  const moonGroup = new THREE.Group();
  moonGroup.rotation.y = -Math.PI / 2; // put 0° longitude (the near-side centre) toward +Z / the camera
  scene.add(moonGroup);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const loadTex = (url, srgb = true) =>
    new Promise((resolve, reject) =>
      loader.load(
        url,
        (t) => {
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = maxAniso;
          t.wrapS = THREE.RepeatWrapping; // filter across the ±180° seam instead of clamping
          resolve(t);
        },
        undefined,
        reject,
      ),
    );

  const [colorMap, normalMap] = await Promise.all([
    loadTex('/textures/moon_color_2k.jpg'),
    loadTex('/textures/moon_normal_2k.jpg', false),
  ]);

  const relief = params.get('relief'); // debug: 'off' | 'flip'
  const segments = lite ? 128 : 192;
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: relief === 'off' ? null : normalMap,
    normalScale: new THREE.Vector2(1, relief === 'flip' ? -1 : 1).multiplyScalar(1.6),
    roughness: 1,
    metalness: 0,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, segments, segments / 2), material);
  moonGroup.add(moon);

  // ---------- Texture tiers ----------
  // 2K color + 2K normal load first (fast first paint), then upgrade:
  //   desktop with 8K texture support → 8K color + 5.7K normal (≈ 9 MB total)
  //   phones/tablets or weaker GPUs   → 4K color, keep 2K normal (≈ 3 MB total)
  const maxTex = renderer.capabilities.maxTextureSize;
  const forced = params.get('tex'); // debug: '2k' | '4k' | '8k'
  let tier = forced || (!lite && maxTex >= 8192 ? '8k' : maxTex >= 4096 ? '4k' : '2k');
  let loadedTier = '2k';
  let minDist = 1.4;
  const swap = (key, t) => {
    const old = material[key];
    material[key] = t;
    material.needsUpdate = true;
    if (old && old !== t) old.dispose();
  };
  const upgrades = [];
  if (tier === '8k') {
    upgrades.push(loadTex('/textures/moon_color_8k.webp').then((t) => swap('map', t)));
    if (relief !== 'off') upgrades.push(loadTex('/textures/moon_normal_6k.webp', false).then((t) => swap('normalMap', t)));
  } else if (tier === '4k') {
    upgrades.push(loadTex('/textures/moon_color_4k.jpg').then((t) => swap('map', t)));
  }
  const texturesReady = Promise.all(upgrades)
    .then(() => {
      loadedTier = tier;
      // Allow a closer approach once the sharper maps are in.
      minDist = tier === '8k' ? 1.25 : tier === '4k' ? 1.32 : 1.4;
      if (mode === 'moon') controls.minDistance = minDist;
    })
    .catch((e) => console.warn('[MoonClaw] texture upgrade failed', e));

  // ---------- Stars (follow the camera, so they're always "at infinity") ----------
  const stars = (() => {
    const count = 4500;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 120);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL(0.55 + Math.random() * 0.15, Math.random() * 0.4, 0.6 + Math.random() * 0.4);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }),
    );
    p.renderOrder = -1;
    p.frustumCulled = false;
    scene.add(p);
    return p;
  })();

  // ---------- Solar system (built now, revealed on demand) ----------
  const solar = createSolarSystem({ renderer, lite, reducedMotion });
  scene.add(solar.group);

  // ---------- Controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 0.9;
  controls.minDistance = minDist;
  controls.maxDistance = MOON_MAX_DIST;
  controls.autoRotateSpeed = 0.6;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  const fitDistance = (radius, fill, min, max) => {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const fov = Math.min(vfov, hfov);
    return THREE.MathUtils.clamp(radius / Math.sin((fov / 2) * fill), min, max);
  };
  // Fit the Moon's diameter into ~68% of the tighter viewport dimension.
  const defaultDistance = () => fitDistance(MOON_RADIUS, 0.68, 2.4, MOON_MAX_DIST);
  const overviewDistance = () => {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // The orbits are seen at an angle, so they're foreshortened vertically.
    return Math.max((solar.extent * 1.12) / Math.tan(hfov / 2), (solar.extent * 0.92) / Math.tan(vfov / 2));
  };
  const OVERVIEW_DIR = new THREE.Vector3(0.38, 0.72, 0.58).normalize();

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  camera.position.copy(DEFAULT_DIR).multiplyScalar(defaultDistance());
  controls.update();
  new ResizeObserver(resize).observe(container);

  const frameShift = { current: 0, target: 0, dirty: false };
  const w0 = () => container.clientWidth || window.innerWidth;
  const h0 = () => container.clientHeight || window.innerHeight;
  new ResizeObserver(() => { frameShift.dirty = true; }).observe(container);

  // ---------- Modes ----------
  // 'moon'   : orbiting the Moon (start)
  // 'solar'  : solar-system view, focused on `focusId` ('sun' = overview)
  let mode = 'moon';
  let focusId = null;
  const setMode = (m, focus = null) => {
    mode = m;
    focusId = focus;
    solar.group.visible = m !== 'moon';
    onModeChange?.(m, focus);
  };

  // ---------- Camera flights ----------
  // Every camera move is: look-target T(t) + direction D(t) × distance R(t),
  // with D slerped, R interpolated in log space (feels like a smooth zoom across scales),
  // and T moving only inside `targetWindow` (fractions of the flight), e.g. so the Moon stays
  // centred while pulling away, or is re-centred early on the way back.
  let flight = null;
  const tmpQ = new THREE.Quaternion();

  function flyTo({ target, dir, dist, duration = 1200, targetWindow = [0, 1], onDone }) {
    const fromTarget = controls.target.clone();
    const offset = camera.position.clone().sub(fromTarget);
    const fromDist = Math.max(offset.length(), 1e-4);
    const fromDir = offset.normalize();
    const toDir = dir.clone().normalize();
    const fullQ = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
    if (fromDir.dot(toDir) < -0.9999) fullQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    flight = {
      start: performance.now(),
      duration: reducedMotion ? 0 : duration,
      fromTarget, toTarget: target.clone(),
      fromDir, fullQ,
      lnFrom: Math.log(fromDist), lnTo: Math.log(dist),
      targetWindow, onDone,
    };
  }

  function stepFlight(now) {
    const f = flight;
    const t = f.duration ? Math.min(1, (now - f.start) / f.duration) : 1;
    const e = easeInOutCubic(t);
    const te = smoothstep(f.targetWindow[0], f.targetWindow[1], e);
    controls.target.lerpVectors(f.fromTarget, f.toTarget, te);
    tmpQ.identity().slerp(f.fullQ, e);
    const d = Math.exp(THREE.MathUtils.lerp(f.lnFrom, f.lnTo, e));
    camera.position.copy(f.fromDir).applyQuaternion(tmpQ).multiplyScalar(d).add(controls.target);
    if (t >= 1) {
      flight = null;
      f.onDone?.();
    }
  }

  const userInput = () => {
    if (flight && flight.cancellable !== false) flight = null; // user input cancels in-mode fly-tos
    onInteract?.();
  };
  controls.addEventListener('start', userInput);
  renderer.domElement.addEventListener('wheel', () => onInteract?.(), { passive: true });

  const configureControls = () => {
    if (mode === 'moon') {
      controls.minDistance = minDist;
      controls.maxDistance = MOON_MAX_DIST;
    } else {
      const b = solar.bodies.get(focusId);
      controls.minDistance = focusId === 'sun' ? b.radius * 1.6 : b.radius * (b.rings ? 2.6 : 1.8);
      controls.maxDistance = Math.max(overviewDistance() * 1.6, 3000);
    }
  };

  // ---------- Landmark pins ----------
  const pins = landmarks.map((lm) => {
    const local = latLonToVector(lm.lat, lm.lon, MOON_RADIUS * 1.003);
    const btn = makePin(lm.id, lm.name, `${lm.name} — show info`, () => onSelect(lm.id));
    return { lm, local, btn, world: new THREE.Vector3(), visible: null };
  });

  // ---------- Solar-system labels ----------
  const bodyPins = [
    ...[...solar.bodies.values()].map((b) => ({
      id: b.id, b, world: b.position,
      btn: makePin(b.id, b.name, `${b.name} — fly there and show info`, () => onSelectBody(b.id), 'body-pin', b.color),
      visible: null,
    })),
    {
      id: 'moon', b: { radius: MOON_RADIUS }, world: ORIGIN,
      btn: makePin('moon', 'Moon', 'Moon — return to the Moon', () => onSelectBody('moon'), 'body-pin', '#d9dce4'),
      visible: null,
    },
  ];

  function makePin(id, name, label, onClick, extra = '', color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pin ${extra}`.trim();
    btn.dataset.id = id;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', label);
    btn.innerHTML = '<span class="pin-dot" aria-hidden="true"></span><span class="pin-label" aria-hidden="true"></span>';
    btn.querySelector('.pin-label').textContent = name;
    if (color) btn.style.setProperty('--pin-color', color);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    btn.classList.add('hidden');
    btn.tabIndex = -1;
    btn.setAttribute('aria-hidden', 'true');
    markerLayer.appendChild(btn);
    return btn;
  }

  const setPinVisible = (p, visible) => {
    if (visible === p.visible) return;
    p.btn.classList.toggle('hidden', !visible);
    p.btn.tabIndex = visible ? 0 : -1;
    p.btn.setAttribute('aria-hidden', String(!visible));
    p.visible = visible;
  };

  const ndc = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  function updatePins(w, h) {
    const showLandmarks = mode === 'moon' && !(flight && flight.modeTransition);
    moonGroup.updateMatrixWorld();
    for (const p of pins) {
      if (!showLandmarks) { setPinVisible(p, false); continue; }
      p.world.copy(p.local).applyMatrix4(moonGroup.matrixWorld);
      toCam.copy(camera.position).sub(p.world).normalize();
      const facing = p.world.clone().normalize().dot(toCam);
      ndc.copy(p.world).project(camera);
      const visible = facing > 0.12 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05;
      setPinVisible(p, visible);
      if (visible) {
        p.btn.style.transform = `translate3d(${((ndc.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-ndc.y * 0.5 + 0.5) * h).toFixed(1)}px, 0)`;
        p.btn.style.opacity = String(THREE.MathUtils.clamp((facing - 0.12) * 5, 0, 1)); // fade toward the limb
      }
    }

    const placed = []; // screen positions of labels already shown (for de-cluttering)
    const showBodies = mode === 'solar' && !flight;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const earthNdc = showBodies ? solar.bodies.get('earth').position.clone().project(camera) : null;
    for (const p of bodyPins) {
      if (!showBodies || (p.id === focusId && focusId !== 'sun')) { setPinVisible(p, false); continue; }
      ndc.copy(p.world).project(camera);
      // From far away the Moon sits on top of Earth; let Earth's label win.
      if (p.id === 'moon' && Math.hypot((ndc.x - earthNdc.x) * w, (ndc.y - earthNdc.y) * h) < 60) { setPinVisible(p, false); continue; }
      const dist = camera.position.distanceTo(p.world);
      const pxRadius = (p.b.radius / dist / tanHalf) * (h / 2);
      // Hide the label of a body that already fills the view (you're looking right at it).
      const visible = ndc.z < 1 && Math.abs(ndc.x) < 1.02 && Math.abs(ndc.y) < 1.02 && pxRadius < Math.min(w, h) * 0.18;
      setPinVisible(p, visible);
      if (visible) {
        const x = (ndc.x * 0.5 + 0.5) * w, y = (-ndc.y * 0.5 + 0.5) * h;
        p.btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        p.btn.style.opacity = '1';
        // Keep the dot (still tappable) but drop the name if it would overlap a label already placed.
        const clash = placed.some((q) => Math.abs(q.y - y) < 18 && x > q.x - 70 && x < q.x + 90);
        p.btn.classList.toggle('no-label', clash);
        if (!clash) placed.push({ x, y });
      }
    }
  }

  // ---------- Loop ----------
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((ts) => {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.1);
    const now = performance.now();
    if (flight) {
      stepFlight(now);
      camera.lookAt(controls.target);
    } else {
      if (mode === 'moon') {
        // Slower rotation when zoomed in close.
        const dist = camera.position.length();
        controls.rotateSpeed = THREE.MathUtils.clamp((dist - MOON_RADIUS) / 3, 0.06, 0.6);
      } else {
        controls.rotateSpeed = 0.6;
      }
      controls.update(dt);
    }

    // Hand lighting over from the camera light (Moon view) to the Sun as you pull away.
    const dMoon = camera.position.length();
    const moonMix = 1 - smoothstep(6, 28, dMoon);
    camLight.intensity = 3.0 * moonMix;
    solar.sunLight.intensity = 3.2 * (1 - moonMix);
    ambient.intensity = 0.18 * moonMix + 0.1 * (1 - moonMix);

    // Keep depth precision sensible across scales.
    const d = camera.position.distanceTo(controls.target);
    const near = THREE.MathUtils.clamp(d * 0.01, 0.01, 8);
    if (Math.abs(near - camera.near) / camera.near > 0.05) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }

    // Shift the picture up when a bottom sheet covers the lower part of the screen (phones).
    const shift = frameShift.current + (frameShift.target - frameShift.current) * (reducedMotion ? 1 : Math.min(1, dt * 6));
    if (Math.abs(shift - frameShift.current) > 1e-4 || frameShift.dirty) {
      frameShift.current = Math.abs(shift - frameShift.target) < 1e-3 ? frameShift.target : shift;
      frameShift.dirty = false;
      if (frameShift.current) camera.setViewOffset(w0(), h0(), 0, frameShift.current * h0(), w0(), h0());
      else camera.clearViewOffset();
    }

    stars.position.copy(camera.position);
    solar.update(dt);
    const w = container.clientWidth, h = container.clientHeight;
    updatePins(w, h);
    renderer.render(scene, camera);
  });

  onReady?.();

  // ---------- Public API ----------
  const currentDir = () => camera.position.clone().sub(controls.target).normalize();
  const sph = new THREE.Spherical();

  function focusView(id) {
    const b = solar.bodies.get(id);
    if (id === 'sun') return { target: b.position, dir: OVERVIEW_DIR, dist: overviewDistance() };
    if (b.face != null && b.mesh) {
      // Turn the best-imaged side (texture u = b.face) toward where the camera will be.
      const d = solar.sunPos.clone().sub(b.position).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(40));
      b.mesh.rotation.y = Math.atan2(-d.z, d.x) - (b.face - 0.5) * Math.PI * 2;
    }
    // Look from the sunward side, swung ~40° so the terminator shows some relief.
    const toSun = solar.sunPos.clone().sub(b.position).normalize();
    const dir = toSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(40)).add(new THREE.Vector3(0, 0.3, 0)).normalize();
    const dist = fitDistance(b.rings ? b.radius * 2.3 : b.radius, b.belt ? 0.2 : 0.55, 0, 1e6);
    return { target: b.position, dir, dist };
  }

  function transition(view, opts, nextMode, nextFocus) {
    controls.enabled = false; // the camera is on rails during a mode change
    flyTo({
      ...view,
      ...opts,
      onDone: () => {
        setMode(nextMode, nextFocus);
        configureControls();
        controls.enabled = true;
        controls.update();
      },
    });
    flight.cancellable = false;
    flight.modeTransition = true;
  }

  return {
    get mode() { return mode; },
    get focus() { return focusId; },
    flyToLandmark(lm) {
      if (mode !== 'moon') return;
      const world = latLonToVector(lm.lat, lm.lon).applyMatrix4(moonGroup.matrixWorld);
      const dist = Math.min(camera.position.length(), 2.1);
      flyTo({ target: ORIGIN, dir: world, dist, duration: 1400 });
    },
    exploreSolarSystem() {
      if (mode !== 'moon' || (flight && flight.modeTransition)) return;
      controls.autoRotate = false;
      solar.group.visible = true;
      onModeChange?.('to-solar', null);
      transition(focusView('sun'), { duration: 5200, targetWindow: [0.42, 1] }, 'solar', 'sun');
    },
    returnToMoon() {
      if (mode === 'moon' || (flight && flight.modeTransition)) return;
      controls.autoRotate = false;
      onModeChange?.('to-moon', null);
      // Re-centre on the Moon early so it stays in frame for the whole approach.
      transition({ target: ORIGIN, dir: DEFAULT_DIR, dist: defaultDistance() }, { duration: 4200, targetWindow: [0, 0.55] }, 'moon', null);
    },
    focusBody(id) {
      if (mode !== 'solar' || !solar.bodies.has(id)) return;
      const v = focusView(id);
      const far = camera.position.distanceTo(v.target);
      focusId = id;
      configureControls();
      controls.minDistance = Math.min(controls.minDistance, v.dist * 0.9);
      flyTo({ ...v, duration: THREE.MathUtils.clamp(1400 + far * 0.6, 1600, 3400) });
      onModeChange?.('solar', id);
    },
    rotateBy(dTheta, dPhi) {
      sph.setFromVector3(camera.position.clone().sub(controls.target));
      sph.theta -= dTheta;
      sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, 0.05, Math.PI - 0.05);
      flyTo({ target: controls.target, dir: new THREE.Vector3().setFromSpherical(sph), dist: sph.radius, duration: 250 });
      onInteract?.();
    },
    zoom(factor) {
      const d = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * factor, controls.minDistance, controls.maxDistance);
      flyTo({ target: controls.target, dir: currentDir(), dist: d, duration: 350 });
      onInteract?.();
    },
    reset() {
      if (mode === 'moon') flyTo({ target: ORIGIN, dir: DEFAULT_DIR, dist: defaultDistance(), duration: 1000 });
      else this.focusBody('sun');
    },
    setAutoRotate(on) {
      controls.autoRotate = on;
    },
    /** Fraction of the viewport height to move the picture up (0 = centred). */
    setFrameShift(f) {
      frameShift.target = f;
    },
    debug: {
      get mode() { return mode; },
      get focus() { return focusId; },
      get distance() { return +camera.position.distanceTo(controls.target).toFixed(3); },
      get cameraPosition() { return camera.position.toArray().map((n) => +n.toFixed(3)); },
      get defaultDistance() { return +defaultDistance().toFixed(3); },
      get minDistance() { return controls.minDistance; },
      get animating() { return !!flight; },
      get visiblePins() { return [...pins, ...bodyPins].filter((p) => p.visible).map((p) => p.lm?.id ?? p.id); },
      get textureWidth() { return material.map?.image?.width ?? 0; },
      get normalWidth() { return material.normalMap?.image?.width ?? 0; },
      get tier() { return loadedTier; },
      get maxTextureSize() { return maxTex; },
      get lite() { return lite; },
      texturesReady,
      /** Jump straight to a camera pose around the Moon (testing close-ups). */
      moonPose(lat, lon, dist) {
        const world = latLonToVector(lat, lon).applyMatrix4(moonGroup.matrixWorld);
        flyTo({ target: ORIGIN, dir: world, dist, duration: 0 });
      },
    },
  };
}
