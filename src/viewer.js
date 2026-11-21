import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MOON_RADIUS = 1;
const MIN_DIST = 1.22;
const MAX_DIST = 9;
const DEFAULT_DIR = new THREE.Vector3(0, 0, 1);

/** Selenographic lat/lon (deg) → point on a unit sphere in the Moon's local frame.
 *  Matches three.js SphereGeometry UVs with an equirectangular map whose centre is 0° lon. */
function latLonToVector(lat, lon, r = MOON_RADIUS) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createViewer({ container, markerLayer, landmarks, reducedMotion, onSelect, onReady, onInteract }) {
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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  scene.add(camera);

  // Light rides with the camera so whichever face you look at is lit,
  // angled from the upper-left to bring out crater relief.
  const sun = new THREE.DirectionalLight(0xfff6e8, 3.0);
  sun.position.set(-2.2, 1.4, 1.6);
  camera.add(sun);
  camera.add(sun.target);
  sun.target.position.set(0, 0, -4);
  scene.add(new THREE.AmbientLight(0x8090b0, 0.18));

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
          resolve(t);
        },
        undefined,
        reject,
      ),
    );

  const [colorMap, bumpMap] = await Promise.all([
    loadTex('/textures/moon_color_2k.jpg'),
    loadTex('/textures/moon_displacement.jpg', false),
  ]);

  const segments = window.matchMedia('(max-width: 720px)').matches ? 96 : 160;
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    bumpMap,
    bumpScale: 2.2,
    roughness: 1,
    metalness: 0,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, segments, segments / 2), material);
  moonGroup.add(moon);

  // Upgrade to the 4K map where the device can handle it.
  const canUse4k =
    renderer.capabilities.maxTextureSize >= 4096 && !window.matchMedia('(max-width: 720px)').matches;
  if (canUse4k) {
    loadTex('/textures/moon_color_4k.jpg')
      .then((t) => {
        material.map = t;
        material.needsUpdate = true;
        colorMap.dispose();
      })
      .catch(() => {});
  }

  // ---------- Stars ----------
  {
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
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    scene.add(stars);
  }

  // ---------- Controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 0.9;
  controls.minDistance = MIN_DIST;
  controls.maxDistance = MAX_DIST;
  controls.autoRotateSpeed = 0.6;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  function defaultDistance() {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const fov = Math.min(vfov, hfov);
    // Fit the Moon's diameter into ~68% of the tighter viewport dimension.
    return THREE.MathUtils.clamp(MOON_RADIUS / Math.sin((fov / 2) * 0.68), 2.4, MAX_DIST);
  }

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

  // ---------- Camera animation ----------
  let anim = null;
  const tmpQ = new THREE.Quaternion();

  function animateTo(dir, dist, duration = 1200) {
    const fromDir = camera.position.clone().normalize();
    const toDir = dir.clone().normalize();
    const fromDist = camera.position.length();
    const toDist = THREE.MathUtils.clamp(dist, MIN_DIST, MAX_DIST);
    const fullQ = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
    // Antipodal edge case: pick an arbitrary perpendicular axis.
    if (fromDir.dot(toDir) < -0.9999) fullQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    anim = {
      start: performance.now(),
      duration: reducedMotion ? 0 : duration,
      fromDir,
      fromDist,
      toDist,
      fullQ,
    };
  }

  function stepAnimation(now) {
    if (!anim) return;
    const t = anim.duration ? Math.min(1, (now - anim.start) / anim.duration) : 1;
    const e = easeInOutCubic(t);
    tmpQ.identity().slerp(anim.fullQ, e);
    const d = THREE.MathUtils.lerp(anim.fromDist, anim.toDist, e);
    camera.position.copy(anim.fromDir).applyQuaternion(tmpQ).multiplyScalar(d);
    if (t >= 1) anim = null;
  }

  controls.addEventListener('start', () => {
    anim = null; // user input cancels any fly-to
    onInteract?.();
  });
  renderer.domElement.addEventListener('wheel', () => onInteract?.(), { passive: true });

  // ---------- Landmark pins ----------
  const pins = landmarks.map((lm) => {
    const local = latLonToVector(lm.lat, lm.lon, MOON_RADIUS * 1.003);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pin';
    btn.dataset.id = lm.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `${lm.name} — show info`);
    btn.innerHTML = '<span class="pin-dot" aria-hidden="true"></span><span class="pin-label" aria-hidden="true"></span>';
    btn.querySelector('.pin-label').textContent = lm.name;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(lm.id);
    });
    markerLayer.appendChild(btn);
    return { lm, local, btn, world: new THREE.Vector3(), visible: null };
  });

  const ndc = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  function updatePins() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    moonGroup.updateMatrixWorld();
    for (const p of pins) {
      p.world.copy(p.local).applyMatrix4(moonGroup.matrixWorld);
      toCam.copy(camera.position).sub(p.world).normalize();
      const facing = p.world.clone().normalize().dot(toCam);
      ndc.copy(p.world).project(camera);
      const onScreen = Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05;
      const visible = facing > 0.12 && onScreen;
      if (visible !== p.visible) {
        p.btn.classList.toggle('hidden', !visible);
        p.btn.tabIndex = visible ? 0 : -1;
        p.btn.setAttribute('aria-hidden', String(!visible));
        p.visible = visible;
      }
      if (visible) {
        const x = (ndc.x * 0.5 + 0.5) * w;
        const y = (-ndc.y * 0.5 + 0.5) * h;
        p.btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        // Fade pins as they approach the limb.
        p.btn.style.opacity = String(THREE.MathUtils.clamp((facing - 0.12) * 5, 0, 1));
      }
    }
  }

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const now = performance.now();
    if (anim) {
      stepAnimation(now);
    } else {
      // Slower rotation when zoomed in close.
      const dist = camera.position.length();
      controls.rotateSpeed = THREE.MathUtils.clamp((dist - MOON_RADIUS) / 3, 0.06, 0.6);
      controls.update(dt);
    }
    camera.lookAt(0, 0, 0);
    updatePins();
    renderer.render(scene, camera);
  });

  onReady?.();

  // ---------- Public API ----------
  const currentDir = () => camera.position.clone().normalize();
  const sph = new THREE.Spherical();

  return {
    flyToLandmark(lm) {
      const world = latLonToVector(lm.lat, lm.lon).applyMatrix4(moonGroup.matrixWorld);
      const dist = Math.min(camera.position.length(), Math.max(2.1, MIN_DIST + 0.6));
      animateTo(world, dist, 1400);
    },
    rotateBy(dTheta, dPhi) {
      sph.setFromVector3(camera.position);
      sph.theta -= dTheta;
      sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, 0.05, Math.PI - 0.05);
      const target = new THREE.Vector3().setFromSpherical(sph);
      animateTo(target, sph.radius, 250);
      onInteract?.();
    },
    zoom(factor) {
      animateTo(currentDir(), camera.position.length() * factor, 350);
      onInteract?.();
    },
    reset() {
      animateTo(DEFAULT_DIR, defaultDistance(), 1000);
    },
    setAutoRotate(on) {
      controls.autoRotate = on;
    },
    debug: {
      get distance() { return +camera.position.length().toFixed(3); },
      get cameraPosition() { return camera.position.toArray().map((n) => +n.toFixed(3)); },
      get defaultDistance() { return +defaultDistance().toFixed(3); },
      get animating() { return !!anim; },
      get visiblePins() { return pins.filter((p) => p.visible).map((p) => p.lm.id); },
      get textureWidth() { return material.map?.image?.width ?? 0; },
    },
  };
}
