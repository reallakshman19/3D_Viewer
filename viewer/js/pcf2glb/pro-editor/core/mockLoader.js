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

export async function loadMockPcfToGlbUrl() {
  try {
    const response = await fetch('data/mocks/mock_complex_piping.pcf');
    if (!response.ok) throw new Error(`Failed to load mock PCF: ${response.statusText}`);
    const text = await response.text();
    return await loadPcfTextToGlbUrl(text);
  } catch (err) {
    console.error("Mock PCF load error:", err);
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
  // Do not fall back to loadMockGlbUrl(); BM_CII review must never silently load
  // an unrelated generic GLB. Surface a clear configuration error instead.
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

  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        const blob = new Blob([gltf], { type: 'application/octet-stream' });
        resolve(URL.createObjectURL(blob));
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}
