import * as THREE from 'three';
import { RESTRAINT_VISUAL_PROFILE } from '../glb/RestraintVisualProfile.js';
import { normalizeSupportRecord } from '../glb/SupportRecordModel.js';
import { buildSupportGlyphGroup, disposeObject3D } from '../glb/RestraintGlyphBuilder.js';

const GLB_SUPPORT_SYMBOLS_GROUP = `__GLB_SUPPORT_SYMBOLS_${RESTRAINT_VISUAL_PROFILE.id}__`;

function sourceOf(data = {}, fallback = '') {
  const layerSource = String(data.bmCiiLayer?.source || '').toLowerCase();
  const traceSource = String(data.bmCiiTrace?.supportSource || data.bmCiiTrace?.source || '').toLowerCase();
  const direct = String(data.supportSource || data.renderSource || fallback || '').toLowerCase();
  if (layerSource.includes('isonote') || traceSource.includes('isonote') || direct.includes('isonote')) return 'isonote';
  return 'inputxml';
}

function isGeneratedRuntimeSymbol(object) {
  const data = object?.userData || {};
  return data.glbSupportSymbol === true || data.glbSupportSymbolMesh === true || data.glbSupportSymbolRoot === true;
}

function isSupportReference(object) {
  const data = object?.userData || {};
  const layer = data.bmCiiLayer || {};
  const trace = data.bmCiiTrace || {};
  const layerIds = layer.layerIds || data.bmCiiLayerIds || [];
  const name = String(object?.name || '').toUpperCase();
  return layer.category === 'support'
    || trace.entity === 'support'
    || layerIds.includes('plant.restraints')
    || Boolean(data.supportRecordId || data.bmCiiSupportRecord)
    || String(data.glbShape || '').startsWith('support-reference-')
    || name.includes('BM_CII_RESTRAINT')
    || name.includes('SUPPORT_ARROW_V7');
}

function isCandidateSupportObject(object) {
  if (!object || (!object.isMesh && object.type !== 'Group')) return false;
  if (isGeneratedRuntimeSymbol(object)) return false;
  return isSupportReference(object);
}

function computeFallbackScale(root, options = {}) {
  const box3 = new THREE.Box3().setFromObject(root);
  const diagonal = box3.isEmpty() ? 1 : box3.getSize(new THREE.Vector3()).length();
  const scaleMultiplier = Number(options.scaleMultiplier) > 0 ? Number(options.scaleMultiplier) : 1.0;
  if (diagonal < 50) return Math.max(0.24, Math.min(0.90, diagonal * 0.082)) * scaleMultiplier;
  return Math.max(24, Math.min(200, diagonal * 0.050)) * scaleMultiplier;
}

function hideBakedSupportMarkers(root) {
  let hidden = 0;
  root.traverse((object) => {
    if (!isSupportReference(object) || isGeneratedRuntimeSymbol(object)) return;
    object.visible = false;
    object.userData = {
      ...(object.userData || {}),
      glbSupportBakedFallback: false,
      hiddenByRuntimeSupportProfile: RESTRAINT_VISUAL_PROFILE.id,
    };
    hidden += 1;
  });
  return hidden;
}

export function applyGlbSupportSymbols(root, scene, options = {}) {
  const existing = scene.getObjectByName(GLB_SUPPORT_SYMBOLS_GROUP) || root.getObjectByName?.(GLB_SUPPORT_SYMBOLS_GROUP);
  if (existing) {
    existing.parent?.remove?.(existing);
    disposeObject3D(existing);
  }

  root.updateMatrixWorld(true);
  const fallbackScale = computeFallbackScale(root, options);
  const symbolRoot = new THREE.Group();
  symbolRoot.name = GLB_SUPPORT_SYMBOLS_GROUP;
  symbolRoot.userData = {
    glbSupportSymbolRoot: true,
    glbSupportVisualProfile: RESTRAINT_VISUAL_PROFILE.id,
  };

  const seen = new Set();
  const worldPos = new THREE.Vector3();
  let scanned = 0;
  let created = 0;
  let traversalIndex = 0;

  root.traverse((object) => {
    if (!isCandidateSupportObject(object)) return;
    const data = object.userData || {};
    object.getWorldPosition(worldPos);
    const record = normalizeSupportRecord(data, sourceOf(data, options.supportSource), data.supportRecordIndex ?? traversalIndex, {
      pipePoint: worldPos.clone(),
      scaleFallback: data.renderScale || data.supportSymbolScale || fallbackScale,
    });
    traversalIndex += 1;

    if (seen.has(record.id)) return;
    seen.add(record.id);
    scanned += 1;

    const group = buildSupportGlyphGroup(record, { mode: 'runtime' });
    group.name = `glb-support-${record.kind.toLowerCase()}-${record.id}`;
    group.userData = {
      ...(group.userData || {}),
      pcfId: data.pcfId || data.componentId || data.supportRecordId || object.name || object.uuid,
      pcfType: data.pcfType || 'SUPPORT',
      refNo: data.refNo || data.REF_NO || '',
      lineNo: data.lineNo || '',
    };
    if (group.children.length || record.kind === 'UNKNOWN') {
      symbolRoot.add(group);
      created += 1;
    }
  });

  const hidden = hideBakedSupportMarkers(root);
  if (created > 0) scene.add(symbolRoot);

  console.info('[glb-support-symbols]', {
    created,
    scanned,
    hidden,
    profile: RESTRAINT_VISUAL_PROFILE.id,
    guide: 'guide-lateral-arrows-tip-at-od2',
    linestop: 'linestop-axial-arrows-offset-od2',
    rest: 'rest-vertical-arrow-tip-at-od2',
    limit: 'limit-axial-arrow-offset-od2',
  });
  return { created, scanned, hidden, scale: fallbackScale, profile: RESTRAINT_VISUAL_PROFILE.id };
}
