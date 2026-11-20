// BP Taxidermy: the bison skull as a real lit 3D model (built in Blender from Bob's photo).
// The flat cutout <img> stays as the fallback until the model is ready, and for no-WebGL / reduced motion.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wrap = document.querySelector(".skull-wrap");
const hero = document.getElementById("hero");
if (wrap && hero && !reduce) start().catch(() => { /* keep the photo fallback */ });

async function start() {
  const canvas = document.createElement("canvas");
  canvas.className = "skull3d";
  canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (_) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0.1, 6.2);

  // light like the shop spotlight: warm key from above, cool fill, blaze-orange rim from behind
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x0e0f0d, 0.55));
  const key = new THREE.SpotLight(0xfff0dc, 95, 0, 0.55, 0.85, 2);
  key.position.set(0.6, 4.2, 4.6);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xff6b1a, 2.6);
  rim.position.set(-3.2, 1.2, -2.5);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd2b0, 0.9);
  rim2.position.set(3.4, 0.4, -1.8);
  scene.add(rim2);

  const tl = new THREE.TextureLoader();
  const loadTex = (u) => new Promise((res, rej) => tl.load(u, res, undefined, rej));
  const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
  const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
  const [gltf, map, blur] = await Promise.all([
    gltfLoader.loadAsync("models/bison-skull.glb"),
    loadTex("img/skull-albedo.jpg"),
    loadTex("img/skull-albedo-blur.jpg"),
  ]);
  for (const t of [map, blur]) { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }

  // side walls of the relief stretch the photo, so they fade to a soft-focus copy of it
  const makeMat = (tint) => {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0, color: tint, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.14 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.blurMap = { value: blur };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vFace;")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvFace = abs(objectNormal.y);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vFace;\nuniform sampler2D blurMap;")
        .replace("#include <map_fragment>", `#ifdef USE_MAP
          vec4 sharpC = texture2D(map, vMapUv);
          vec4 softC = texture2D(blurMap, vMapUv);
          diffuseColor *= mix(softC, sharpC, smoothstep(0.18, 0.62, vFace));
        #endif`);
    };
    return m;
  };
  const front = makeMat(0xffffff), back = makeMat(0x9a958c);
  const skull = new THREE.Group();
  const model = gltf.scene;
  let i = 0;
  model.traverse((o) => { if (o.isMesh) { o.material = i++ === 0 ? front : back; } });
  model.rotation.x = Math.PI / 2; // Blender relief faces +Y in glTF space; stand it up facing the camera
  skull.add(model);
  scene.add(skull);
  key.target = skull;

  wrap.appendChild(canvas);
  const size = () => {
    const r = wrap.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  };
  size();
  addEventListener("resize", size);

  // input: idle sway + pointer + scroll
  let px = 0, py = 0, tx = 0, ty = 0;
  if (matchMedia("(pointer:fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
  }
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 30));
    ty = Math.max(-1, Math.min(1, (e.beta - 50) / 30));
  });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);

  if (location.search.includes("debug")) window.__skull = { skull, shot: () => { renderer.render(scene, camera); return canvas.toDataURL("image/jpeg", 0.8); } };
  document.documentElement.classList.add("has3d");
  const t0 = performance.now();
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 4);
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = (now - t0) / 1000;
    const intro = ease(t / 1.8);
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    const r = hero.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    // the relief reads as solid up to ~35 degrees of turn, so every input is capped inside that
    const yaw = (1 - intro) * -0.5 + Math.sin(t * 0.45) * 0.2 + px * 0.34 + sp * 0.4;
    skull.rotation.y = Math.max(-0.62, Math.min(0.62, yaw));
    skull.rotation.x = Math.sin(t * 0.31) * 0.05 + py * 0.16 - sp * 0.2;
    skull.position.y = (1 - intro) * -0.7 + Math.sin(t * 0.8) * 0.03 - sp * 0.4;
    skull.scale.setScalar(0.9 + intro * 0.1 - sp * 0.12);
    canvas.style.opacity = String(intro * (1 - sp * 0.7));
    renderer.render(scene, camera);
  })(t0);
}
