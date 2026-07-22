import * as THREE from "/vendor/three.module.js";

let renderer;
let scene;
let camera;
let globeGroup;
let globeWire;
let atmosphere;
let stars;
let orbitRig;
let orbitRingA;
let orbitRingB;
let focusBeacon;
let focusCore;
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
let latest = {
  energy: 0.4,
  beat: 0,
  playing: false,
  centerLon: 0,
  centerLat: 0,
  focusX: 50,
  focusY: 50,
  focusVisible: false,
  focusScore: 0
};

function makeStars(count = 420) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 1.12 + Math.random() * 0.34;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0x39f5b0,
    size: 0.012,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
}

function resize(canvas) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function makeOrbitRing(color) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(1.13, 0.0065, 8, 180),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
}

function makeFocusBeacon() {
  const group = new THREE.Group();
  const material = (color, opacity) => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.052, 0.061, 64), material(0x39f5b0, 0.78));
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.031, 48), material(0xf7c95c, 0.9));
  focusCore = new THREE.Mesh(new THREE.CircleGeometry(0.011, 32), material(0xf7f4e8, 0.95));
  outer.name = "outer";
  inner.name = "inner";
  group.add(outer, inner, focusCore);
  group.visible = false;
  return group;
}

function animate(time = 0) {
  if (!renderer) return;
  const canvas = renderer.domElement;
  if (canvas.width !== Math.round(canvas.clientWidth * renderer.getPixelRatio())
    || canvas.height !== Math.round(canvas.clientHeight * renderer.getPixelRatio())) resize(canvas);

  const pulse = latest.playing ? Math.pow(Math.max(0, Math.sin(latest.beat * Math.PI * 2)), 7) : 0.08;
  const targetScale = 1 + latest.energy * 0.014 + pulse * (0.018 + latest.energy * 0.024);
  globeGroup.scale.setScalar(THREE.MathUtils.lerp(globeGroup.scale.x, targetScale, 0.16));
  if (!reducedMotion) globeGroup.rotation.y += latest.playing ? 0.00035 + latest.energy * 0.00045 : 0.00012;
  stars.rotation.y = reducedMotion ? 0 : time * 0.000018;
  stars.rotation.z = Math.sin(time * 0.00012) * 0.04;
  stars.material.opacity = 0.34 + latest.energy * 0.22 + pulse * 0.28;
  stars.material.size = 0.009 + latest.energy * 0.006 + pulse * 0.006;
  globeWire.material.opacity = 0.035 + latest.energy * 0.035 + pulse * 0.06;
  atmosphere.material.opacity = 0.07 + latest.energy * 0.05 + pulse * 0.07;
  orbitRingA.material.opacity = 0.16 + latest.energy * 0.22 + pulse * 0.22;
  orbitRingB.material.opacity = 0.11 + latest.energy * 0.16 + pulse * 0.16;
  if (!reducedMotion) {
    orbitRig.rotation.z += 0.0005 + latest.energy * 0.00075;
    orbitRingA.rotation.y += 0.0008;
    orbitRingB.rotation.x -= 0.00055;
  }

  focusBeacon.visible = Boolean(latest.focusVisible);
  if (focusBeacon.visible) {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfWidth = halfHeight * camera.aspect;
    const targetX = ((latest.focusX / 50) - 1) * halfWidth;
    const targetY = (1 - (latest.focusY / 50)) * halfHeight;
    focusBeacon.position.x = THREE.MathUtils.lerp(focusBeacon.position.x, targetX, 0.24);
    focusBeacon.position.y = THREE.MathUtils.lerp(focusBeacon.position.y, targetY, 0.24);
    const matchLift = Math.max(0, Math.min(1, latest.focusScore / 100));
    const beaconScale = 0.82 + matchLift * 0.34 + pulse * 0.34;
    focusBeacon.scale.setScalar(beaconScale);
    focusBeacon.rotation.z = reducedMotion ? 0 : time * 0.0008;
    focusBeacon.children[0].material.opacity = 0.5 + matchLift * 0.32 + pulse * 0.18;
    focusBeacon.children[1].material.opacity = 0.58 + pulse * 0.34;
    focusCore.material.opacity = 0.72 + pulse * 0.28;
  }
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

function mount(canvas) {
  if (!canvas || renderer) return;
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
  });
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  camera.position.z = 3.15;

  globeGroup = new THREE.Group();
  globeWire = new THREE.Mesh(
    new THREE.SphereGeometry(1, 52, 52),
    new THREE.MeshBasicMaterial({
      color: 0x39f5b0,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.075, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x97e7ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  stars = makeStars();
  orbitRig = new THREE.Group();
  orbitRingA = makeOrbitRing(0x39f5b0);
  orbitRingB = makeOrbitRing(0xf7c95c);
  orbitRingA.rotation.x = Math.PI * 0.38;
  orbitRingA.rotation.y = Math.PI * 0.12;
  orbitRingB.rotation.x = Math.PI * 0.62;
  orbitRingB.rotation.y = -Math.PI * 0.18;
  orbitRig.add(orbitRingA, orbitRingB);
  focusBeacon = makeFocusBeacon();
  globeGroup.add(globeWire, atmosphere, stars, orbitRig);
  scene.add(globeGroup, focusBeacon);
  resize(canvas);
  window.requestAnimationFrame(animate);
}

function update(next = {}) {
  latest = { ...latest, ...next };
}

window.RadioXWorld3D = { mount, update };
window.dispatchEvent(new CustomEvent("radiox:world3d-ready"));
