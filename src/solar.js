import * as THREE from 'three';
import { BODIES, daysSinceJ2000 } from './bodies.js';

// Layout (scene units). The Moon sits at the origin with radius 1, its near side facing +Z.
// Earth is placed just beyond the default camera, so pulling back from the Moon flies past it.
export const EARTH_POS = new THREE.Vector3(9, -4, 30);
const EARTH_ANGLE = THREE.MathUtils.degToRad(40); // direction of Earth as seen from the Sun

const deg = THREE.MathUtils.degToRad;

export function createSolarSystem({ renderer, lite, reducedMotion }) {
  const group = new THREE.Group();
  group.visible = false;

  const earthOrbit = BODIES.find((b) => b.id === 'earth').orbit;
  const earthDir = new THREE.Vector3(Math.sin(EARTH_ANGLE), 0, Math.cos(EARTH_ANGLE));
  const sunPos = EARTH_POS.clone().addScaledVector(earthDir, -earthOrbit);

  const days = daysSinceJ2000();
  const earthL = BODIES.find((b) => b.id === 'earth').L0 + 0.98561 * days;
  /** heliocentric ecliptic longitude (deg) → scene angle where Earth is at EARTH_ANGLE */
  const sceneAngle = (L) => EARTH_ANGLE + deg(L - earthL);
  const onPlane = (angle, r) => new THREE.Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r);

  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (file, srgb = true) => {
    const t = loader.load(`/textures/planets/${file}`);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const seg = lite ? 48 : 72;

  // ---------- Lighting (Sun) ----------
  const sunLight = new THREE.PointLight(0xfff3e0, 0, 0, 0); // intensity set by the viewer
  sunLight.position.copy(sunPos);
  group.add(sunLight);

  // ---------- Orbits ----------
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x8b96b8, transparent: true, opacity: 0.32, depthWrite: false });
  const addOrbit = (points) => {
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), orbitMat);
    line.position.copy(sunPos);
    group.add(line);
  };

  const plutoOrbit = (b, M) => {
    // Simple Keplerian ellipse (true anomaly ≈ mean anomaly is fine at this fidelity), then incline it.
    const a = b.orbit, e = b.ecc;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(M));
    const v = onPlane(sceneAngle(b.peri) + M, r);
    const axis = onPlane(sceneAngle(b.node), 1);
    return v.applyAxisAngle(axis, deg(b.incl));
  };

  // ---------- Bodies ----------
  const bodies = new Map();
  const spinners = [];
  for (const b of BODIES) {
    let pos;
    if (b.id === 'sun') pos = sunPos.clone();
    else if (b.id === 'earth') pos = EARTH_POS.clone();
    else if (b.id === 'pluto') pos = sunPos.clone().add(plutoOrbit(b, deg(b.L0 + b.n * days - b.peri)));
    else if (b.belt) pos = sunPos.clone().add(onPlane(EARTH_ANGLE + deg(b.angleOffset), b.orbit));
    else pos = sunPos.clone().add(onPlane(sceneAngle(b.L0 + b.n * days), b.orbit));

    const entry = { ...b, position: pos, mesh: null };
    bodies.set(b.id, entry);

    if (b.id !== 'sun' && !b.belt) {
      if (b.id === 'pluto') {
        const pts = [];
        for (let i = 0; i < 256; i++) pts.push(plutoOrbit(b, (i / 256) * Math.PI * 2));
        addOrbit(pts);
      } else {
        const pts = [];
        for (let i = 0; i < 256; i++) pts.push(onPlane((i / 256) * Math.PI * 2, b.orbit));
        addOrbit(pts);
      }
    }
    if (b.belt) continue;

    const geo = new THREE.SphereGeometry(b.radius, b.id === 'sun' ? 64 : seg, b.id === 'sun' ? 32 : seg / 2);
    let mat;
    if (b.id === 'sun') {
      mat = new THREE.MeshBasicMaterial({ map: tex(b.texture), color: 0xffffff });
      mat.toneMapped = false;
    } else {
      mat = new THREE.MeshStandardMaterial({ map: tex(b.texture), roughness: 1, metalness: 0 });
    }
    const holder = new THREE.Group(); // tilt
    holder.position.copy(pos);
    holder.rotation.z = deg(b.tilt || 0);
    const mesh = new THREE.Mesh(geo, mat);
    holder.add(mesh);
    group.add(holder);
    entry.mesh = mesh;
    if (b.spin) spinners.push({ mesh, rate: b.spin * 0.05 });

    if (b.clouds) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(b.radius * 1.012, seg, seg / 2),
        new THREE.MeshStandardMaterial({ alphaMap: tex(b.clouds, false), color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, roughness: 1 }),
      );
      holder.add(clouds);
      spinners.push({ mesh: clouds, rate: b.spin * 0.065 });
    }

    if (b.rings) {
      const inner = b.radius * 1.24, outer = b.radius * 2.3;
      const rg = new THREE.RingGeometry(inner, outer, 128, 1);
      const uv = rg.attributes.uv, p = rg.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (r - inner) / (outer - inner), 0.5);
      }
      // Unlit: the Sun sits almost edge-on to the rings, so physically-lit rings would look black.
      const ring = new THREE.Mesh(
        rg,
        new THREE.MeshBasicMaterial({ map: tex(b.rings), color: new THREE.Color(1.35, 1.3, 1.2), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      holder.add(ring);
    }

    if (b.id === 'sun') {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc46b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      glow.scale.setScalar(b.radius * 5.5);
      glow.material.toneMapped = false;
      holder.add(glow);
    }
  }

  // ---------- Asteroid belt ----------
  {
    const belt = bodies.get('belt');
    const count = lite ? 2500 : 6000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = belt.orbit - 40 + Math.random() * 80 + (Math.random() - 0.5) * 20;
      const y = (Math.random() + Math.random() + Math.random() - 1.5) * 8;
      pos.set([Math.sin(a) * r, y, Math.cos(a) * r], i * 3);
      c.setHSL(0.08, 0.15, 0.45 + Math.random() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    pts.position.copy(sunPos);
    group.add(pts);
  }

  return {
    group,
    sunLight,
    sunPos,
    bodies,
    /** Radius of a circle around the Sun that contains every orbit (for framing the overview). */
    extent: 1250,
    update(dt) {
      if (reducedMotion || !group.visible) return;
      for (const s of spinners) s.mesh.rotation.y += s.rate * dt;
    },
  };
}

function glowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.2, 'rgba(255,200,110,0.65)');
  grad.addColorStop(0.45, 'rgba(255,160,60,0.18)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
