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
const BM_CII_DEFAULT_LATEST_GLB_URL = 'benchmarks/bm-cii/latest/BM_CII_latest_engineering.glb';

function resolveBenchmarkUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
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

async function loadFirstAvailableGlb(candidates = []) {
  const unique = [...new Set(candidates.filter(Boolean))];
  const failures = [];
  for (const candidate of unique) {
    const url = resolveBenchmarkUrl(candidate);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        failures.push(`${candidate}: ${response.status}`);
        continue;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      failures.push(`${candidate}: ${err?.message || err}`);
    }
  }
  throw new Error(`No BM_CII benchmark GLB found. Update ${BM_CII_LATEST_GLB_MANIFEST_URL} or add ${BM_CII_DEFAULT_LATEST_GLB_URL}. ${failures.join('; ')}`);
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
    latest.url,
    latest.glbUrl,
    manifest?.latestUrl,
    ...(Array.isArray(manifest?.candidates) ? manifest.candidates.map((item) => item?.url || item?.glbUrl || item) : []),
    BM_CII_DEFAULT_LATEST_GLB_URL,
  ];
  return loadFirstAvailableGlb(candidates);
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
