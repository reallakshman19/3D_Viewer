import * as THREE from 'three';
import { STAGE_RENDER_PLAN_SCHEMA } from './StageRenderPlan.js';
import { createPreviewObject, createSelectionBox } from './StagePreviewGeometry.js';
import { disposeObjectTree } from './StagePreviewDisposal.js';

const SUPPORTED_RENDER_KINDS = ['CYLINDER', 'BOX', 'ELBOW', 'FACET_GROUP', 'UNKNOWN_DIAGNOSTIC', 'hidden'];

export function createStageThreePreviewRenderer(canvasHost) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.domElement.className = 'json-viewer-webgl-canvas';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const rootGroup = new THREE.Group();
  const selectionGroup = new THREE.Group();
  scene.add(rootGroup, selectionGroup, new THREE.AmbientLight(0xffffff, 0.7));
  const light = new THREE.DirectionalLight(0xffffff, 0.85);
  light.position.set(3, 4, 5);
  scene.add(light);

  canvasHost.appendChild(renderer.domElement);
  const state = { canvasHost, scene, camera, renderer, rootGroup, selectionGroup, selectedRef: null, disposed: false };
  state.onResize = () => resizeStagePreview(state);
  window.addEventListener('resize', state.onResize);
  resizeStagePreview(state);
  return state;
}

export function renderStagePreview(rendererState, model, renderPlan) {
  if (!rendererState || rendererState.disposed) return;
  disposeObjectTree(rendererState.rootGroup);
  disposeObjectTree(rendererState.selectionGroup);
  if (!model || renderPlan?.schema !== STAGE_RENDER_PLAN_SCHEMA) return draw(rendererState);

  const primitiveById = new Map((model.primitives || []).map((primitive) => [primitive.id, primitive]));
  const visibleBboxes = [];
  for (const entry of renderPlan.entries || []) {
    if (entry.output === 'hidden') continue;
    const object = createPreviewObject(entry, primitiveById.get(entry.primitiveId));
    if (!object) continue;
    object.userData.stageRenderEntryId = entry.id;
    rendererState.rootGroup.add(object);
    if (entry.bboxWorld) visibleBboxes.push(entry.bboxWorld);
  }
  if (renderPlan.source?.quality !== 'hidden') renderSelection(rendererState, model);
  fitCamera(rendererState, mergeBboxes(visibleBboxes) || modelBbox(model));
  draw(rendererState);
}

export function disposeStageThreePreviewRenderer(rendererState) {
  if (!rendererState || rendererState.disposed) return;
  window.removeEventListener('resize', rendererState.onResize);
  disposeObjectTree(rendererState.rootGroup);
  disposeObjectTree(rendererState.selectionGroup);
  rendererState.renderer.dispose();
  rendererState.renderer.domElement.remove();
  rendererState.disposed = true;
}

function renderSelection(state, model) {
  const bbox = selectedBbox(model, state.selectedRef);
  const box = createSelectionBox(bbox);
  if (box) state.selectionGroup.add(box);
}

function selectedBbox(model, ref) {
  if (!model || !ref) return null;
  if (ref.type === 'node') return model.hierarchy?.nodes?.find((item) => item.id === ref.id)?.bboxWorld;
  if (ref.type === 'component') return model.components?.find((item) => item.id === ref.id)?.bboxWorld;
  if (ref.type === 'primitive') return model.primitives?.find((item) => item.id === ref.id)?.transform?.bboxWorld;
  return modelBbox(model);
}

function modelBbox(model) {
  const bboxes = [...(model?.components || []), ...(model?.hierarchy?.nodes || [])].map((item) => item.bboxWorld).filter(Boolean);
  return mergeBboxes(bboxes);
}

function mergeBboxes(bboxes) {
  if (!bboxes.length) return null;
  return bboxes.reduce((box, next) => [
    Math.min(box[0], next[0]), Math.min(box[1], next[1]), Math.min(box[2], next[2]),
    Math.max(box[3], next[3]), Math.max(box[4], next[4]), Math.max(box[5], next[5]),
  ]);
}

function fitCamera(state, bbox) {
  resizeStagePreview(state);
  if (!bbox) {
    state.camera.position.set(4, 3, 6);
    state.camera.lookAt(0, 0, 0);
    return;
  }
  const center = new THREE.Vector3((bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2);
  const radius = Math.max(new THREE.Vector3(bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]).length() / 2, 1);
  state.camera.near = Math.max(radius / 1000, 0.01);
  state.camera.far = radius * 1000;
  state.camera.position.copy(center).add(new THREE.Vector3(radius * 1.8, radius * 1.3, radius * 2.2));
  state.camera.lookAt(center);
  state.camera.updateProjectionMatrix();
}

function resizeStagePreview(state) {
  const width = Math.max(state.canvasHost.clientWidth || 1, 1);
  const height = Math.max(state.canvasHost.clientHeight || 1, 1);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height, false);
}

function draw(state) {
  state.renderer.render(state.scene, state.camera);
}

export { SUPPORTED_RENDER_KINDS };
