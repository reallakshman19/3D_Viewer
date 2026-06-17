import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { parsePcfText } from '../../pcf/parsePcfText.js';
import { normalizePcfModel } from '../../pcf/normalizePcfModel.js';
import { buildExportScene } from '../../glb/buildExportScene.js';
import { exportSceneToGLB } from '../../glb/exportSceneToGLB.js';

// Fallback logger if one isn't provided
const dummyLogger = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

const BM_CII_LATEST_GLB_MANIFEST_URL = 'benchmarks/bm-cii/latest-glb-manifest.json';
// Keep empty by default so the deployed viewer has no mandatory binary GLB asset.
// IMPORTANT: the BM_CII quick mock must not fall back to the generic pipe/flange
// mock, because that makes review screenshots look like the wrong benchmark.
const BM_CII_DEFAULT_LATEST_GLB_URL = '';

function resolveBenchmarkUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (typeof window !== 'undefined' && window.location) {
    return new URL(url.replace(/^\/+/, ''), `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`).toString();
  }
  return url;
}

async function fetchJsonQuietly(url) {
  try {
    const response = await fetch(resolveBenchmarkUrl(url), { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

function normalizeCandidate(candidate) {
  if (!candidate) return null;
  if (typeof candidate === 'string') return { url: candidate, encoding: candidate.endsWith('.b64') ? 'base64' : 'binary' };
  const url = candidate.url || candidate.glbUrl || candidate.base64Url || candidate.href || '';
  if (!url) return null;
  const encoding = candidate.encoding || candidate.format || (candidate.base64Url ? 'base64' : (url.endsWith('.b64') ? 'base64' : 'binary'));
  return { url, encoding: String(encoding).toLowerCase(), description: candidate.description || '' };
}

function hasConfiguredCandidate(candidates = []) {
  return candidates.map(normalizeCandidate).some(Boolean);
}

function base64ToBlobUrl(base64Text) {
  const cleaned = String(base64Text || '').replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

async function loadCandidateGlb(candidate) {
  const item = normalizeCandidate(candidate);
  if (!item) throw new Error('empty candidate');
  const url = resolveBenchmarkUrl(item.url);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status}`);
  if (item.encoding === 'base64' || item.encoding === 'b64') {
    return base64ToBlobUrl(await response.text());
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function loadFirstAvailableGlb(candidates = []) {
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates.map(normalizeCandidate).filter(Boolean)) {
    const key = `${candidate.encoding}:${candidate.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  const failures = [];
  if (unique.length === 0) {
    throw new Error(`BM_CII latest GLB is not configured. Update ${BM_CII_LATEST_GLB_MANIFEST_URL} with a BM_CII GLB URL or base64Url.`);
  }
  for (const candidate of unique) {
    try {
      return await loadCandidateGlb(candidate);
    } catch (err) {
      failures.push(`${candidate.url}: ${err?.message || err}`);
    }
  }
  throw new Error(`No BM_CII benchmark GLB found. Update ${BM_CII_LATEST_GLB_MANIFEST_URL}. ${failures.join('; ')}`);
}

function exportSceneBlobUrl(scene) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
        resolve(URL.createObjectURL(blob));
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}

function orientFromY(object, direction) {
  const dir = direction?.clone?.().normalize?.();
  if (!dir || dir.lengthSq() < 1e-9) return;
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

function addCylinderBetween(scene, name, a, b, radius, color) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = delta.length();
  if (length <= 1e-6) return null;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 })
  );
  mesh.name = name;
  mesh.position.copy(start.clone().add(delta.multiplyScalar(0.5)));
  orientFromY(mesh, new THREE.Vector3().subVectors(end, start));
  scene.add(mesh);
  return mesh;
}

function addBall(scene, name, position, radius, color, userData = {}) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.06, roughness: 0.4 })
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData = userData;
  scene.add(mesh);
  return mesh;
}

function makeCanvasLabelTexture(text, opts = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = opts.width || 512;
  canvas.height = opts.height || 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = opts.background || 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = opts.border || '#38bdf8';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = opts.foreground || '#f8fafc';
  ctx.font = opts.font || 'bold 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function addLabelBoard(scene, name, text, position, color = 0x38bdf8, userData = {}) {
  const texture = makeCanvasLabelTexture(text);
  const material = texture
    ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(56, 18), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData = {
    entity: 'annotation',
    semanticCategory: 'annotation',
    labelText: text.replace(/^N/, ''),
    labelDisplayText: text,
    ...userData,
  };
  scene.add(mesh);
  return mesh;
}

function addArrow(scene, name, tip, dir, length, color) {
  const d = new THREE.Vector3(...dir).normalize();
  const p = new THREE.Vector3(...tip);
  const tail = p.clone().add(d.clone().multiplyScalar(-length));
  const headLen = length * 0.35;
  const shaftEnd = p.clone().add(d.clone().multiplyScalar(-headLen));
  addCylinderBetween(scene, `${name}-shaft`, tail.toArray(), shaftEnd.toArray(), 1.15, color);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(4.0, headLen, 18),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.42 })
  );
  head.name = `${name}-head`;
  head.position.copy(shaftEnd.clone().add(d.clone().multiplyScalar(headLen * 0.5)));
  orientFromY(head, d);
  scene.add(head);
}

async function loadBmCiiProceduralBenchmarkGlbUrl() {
  const scene = new THREE.Scene();
  scene.name = 'BM_CII_QUICK_MOCK_GENERATED';
  scene.userData = {
    benchmark: 'BM_CII',
    source: 'procedural quick mock fallback',
    note: 'BM_CII-specific fallback; configure latest-glb-manifest.json to load a generated benchmark GLB file.',
  };

  const pipeColor = 0x9ca3af;
  addCylinderBetween(scene, 'BM_CII-main-pipe-35-130', [0, 0, -210], [0, 0, -460], 7.5, pipeColor);
  addCylinderBetween(scene, 'BM_CII-branch-to-205', [0, 0, -260], [-120, 34, -110], 5.5, pipeColor);
  addCylinderBetween(scene, 'BM_CII-riser-to-255', [0, 0, -380], [0, 110, -380], 4.8, pipeColor);

  const nodes = [
    ['10', [0, 0, -120]],
    ['35', [0, 0, -264]],
    ['130', [0, 0, -462]],
    ['190', [-65, 18, -180]],
    ['205', [-121, 34, -110]],
    ['240', [-35, 84, -290]],
    ['255', [0, 110, -380]],
  ];
  for (const [node, p] of nodes) {
    addBall(scene, `node-${node}-marker`, p, 4.2, 0x38bdf8, {
      TYPE: 'NODE ANNOTATION', NODE: node, SOURCE: 'InputXML', labelText: node, labelDisplayText: `N${node}`,
    });
    addCylinderBetween(scene, `node-${node}-leader`, p, [p[0] + 34, p[1] + 42, p[2] + 20], 0.55, 0x38bdf8);
    addLabelBoard(scene, `node-${node}-label-board`, `N${node}`, [p[0] + 58, p[1] + 52, p[2] + 22], 0x38bdf8, {
      TYPE: 'NODE ANNOTATION', NODE: node, SOURCE: 'InputXML', glbShape: 'node-label-board',
    });
  }

  // BM_CII support/restraint review glyphs. These are intentionally simple but
  // benchmark-specific, not the unrelated generic pipe/flange mock.
  addArrow(scene, 'support-35-rest-plus-y', [0, -8, -264], [0, 1, 0], 38, 0xfacc15);
  addArrow(scene, 'support-35-axis-x-plus', [-8, 0, -264], [1, 0, 0], 34, 0xf59e0b);
  addArrow(scene, 'support-35-axis-x-minus', [8, 0, -264], [-1, 0, 0], 34, 0xf59e0b);
  addArrow(scene, 'support-130-linestop-plus-z', [0, -8, -462], [0, 0, 1], 40, 0xef4444);
  addArrow(scene, 'support-205-limit-axial-plus', [-121, 26, -110], [1, 0, 0], 35, 0xef4444);
  addArrow(scene, 'support-205-limit-axial-minus', [-121, 26, -110], [-1, 0, 0], 35, 0xef4444);
  addArrow(scene, 'support-255-guide-x-plus', [-5, 110, -380], [1, 0, 0], 34, 0x22c55e);
  addArrow(scene, 'support-255-guide-x-minus', [5, 110, -380], [-1, 0, 0], 34, 0x22c55e);

  addLabelBoard(scene, 'BM_CII-quick-mock-title', 'BM_CII QUICK MOCK', [0, 165, -270], 0xf59e0b, {
    TYPE: 'BENCHMARK TITLE', SOURCE: 'BM_CII procedural fallback',
  });

  return await exportSceneBlobUrl(scene);
}

export async function loadMockPcfToGlbUrl() {
  try {
    const response = await fetch('data/mocks/mock_complex_piping.pcf');
    if (!response.ok) throw new Error(`Failed to load mock PCF: ${response.statusText}`);
    const text = await response.text();
    return await loadPcfTextToGlbUrl(text);
  } catch (err) {
    console.error('Mock PCF load error:', err);
    throw err;
  }
}

export async function loadBmCiiLatestGlbUrl() {
  const manifest = await fetchJsonQuietly(BM_CII_LATEST_GLB_MANIFEST_URL);
  const latest = manifest?.latest || {};
  const candidates = [
    { url: latest.url, encoding: latest.encoding || 'binary', description: latest.description },
    { url: latest.glbUrl, encoding: latest.encoding || 'binary', description: latest.description },
    { url: latest.base64Url, encoding: 'base64', description: latest.description },
    { url: manifest?.latestUrl, encoding: manifest?.latestEncoding || 'binary' },
    ...(Array.isArray(manifest?.candidates) ? manifest.candidates : []),
    { url: BM_CII_DEFAULT_LATEST_GLB_URL, encoding: 'binary' },
  ];
  if (!hasConfiguredCandidate(candidates) && manifest?.proceduralFallback !== false) {
    return await loadBmCiiProceduralBenchmarkGlbUrl();
  }
  // Do not fall back to loadMockGlbUrl(); BM_CII review must never silently load
  // an unrelated generic GLB. If no deployed/generated GLB is configured, use the
  // BM_CII-specific procedural fallback above.
  return await loadFirstAvailableGlb(candidates);
}

export async function loadPcfTextToGlbUrl(text) {
  const parsed = parsePcfText(text, dummyLogger);
  const model = normalizePcfModel(parsed, dummyLogger);
  const exportScene = buildExportScene(model, dummyLogger);
  const blob = await exportSceneToGLB(exportScene);
  return URL.createObjectURL(blob);
}

export async function loadMockGlbUrl() {
  // We can just generate a simple GLB blob on the fly in the browser since Node polyfills are annoying
  const scene = new THREE.Scene();
  const geometry = new THREE.CylinderGeometry(5, 5, 200, 32);
  geometry.rotateZ(Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.8 });
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.userData = { pcfId: 'MOCK-GLB-PIPE', pcfType: 'PIPE' };
  scene.add(cylinder);

  // Add some flanges
  const flangeGeo = new THREE.CylinderGeometry(8, 8, 10, 32);
  flangeGeo.rotateZ(Math.PI / 2);
  
  const flange1 = new THREE.Mesh(flangeGeo, material);
  flange1.position.set(-100, 0, 0);
  flange1.userData = { pcfId: 'MOCK-GLB-FLANGE-1', pcfType: 'FLANGE' };
  scene.add(flange1);

  const flange2 = new THREE.Mesh(flangeGeo, material);
  flange2.position.set(100, 0, 0);
  flange2.userData = { pcfId: 'MOCK-GLB-FLANGE-2', pcfType: 'FLANGE' };
  scene.add(flange2);

  return await exportSceneBlobUrl(scene);
}
