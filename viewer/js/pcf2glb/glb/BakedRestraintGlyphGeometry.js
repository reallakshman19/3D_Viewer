import * as THREE from 'three';
import { RESTRAINT_VISUAL_PROFILE } from './RestraintVisualProfile.js';
import { normalizeSupportRecord } from './SupportRecordModel.js';
import { buildSupportGlyphGroup, stampSupportObjectMetadata } from './RestraintGlyphBuilder.js';

function attrsFrom(object, comp = {}) {
  return { ...(comp.raw || {}), ...(comp.attributes || {}), ...(object?.userData || {}), ...comp };
}

function hideExistingProxyMeshes(object, markerGroupName) {
  const hidden = [];
  for (const child of object.children || []) {
    if (child.name === markerGroupName) continue;
    child.traverse?.((node) => {
      if (node.isMesh) {
        node.visible = false;
        hidden.push(node.name || node.uuid);
      }
    });
  }
  return hidden;
}

function localPipePoint() {
  return new THREE.Vector3(0, 0, 0);
}

export function applyBakedRestraintGlyph(object, comp = {}, options = {}) {
  if (!object || comp.type !== 'SUPPORT') return object;

  const attrs = attrsFrom(object, comp);
  const source = options.supportRendering?.source || options.supportSource || attrs.supportSource || attrs.source || 'inputxml';
  const record = normalizeSupportRecord(attrs, source, attrs.supportRecordIndex ?? attrs.recordIndex ?? 0, {
    pipePoint: localPipePoint(),
  });

  const markerGroup = buildSupportGlyphGroup(record, { mode: 'baked' });
  const hiddenOriginalProxyMeshes = hideExistingProxyMeshes(object, markerGroup.name);
  object.add(markerGroup);

  stampSupportObjectMetadata(object, record, {
    role: 'baked-object-root',
    renderGlyph: `baked-${RESTRAINT_VISUAL_PROFILE.id}-${record.kind.toLowerCase()}`,
  });

  object.userData = {
    ...(object.userData || {}),
    labelText: object.userData?.labelText || `${record.node} ${record.kind}`,
    glbShape: `support-reference-${RESTRAINT_VISUAL_PROFILE.id}-${record.kind.toLowerCase()}`,
    directionalSupportEnhanced: true,
    directionalSupportSymbolCount: markerGroup.children.length,
    supportReferenceStyle: true,
    supportReferenceStyleV5: true,
    hiddenOriginalProxyMeshCount: hiddenOriginalProxyMeshes.length,
  };

  if (record.kind === 'UNKNOWN') object.visible = false;
  return object;
}
