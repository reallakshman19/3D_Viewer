import { renderSupportMapperPanel } from '../../../../rvm-viewer/RvmSupportMapper.js';

function _toText(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function _esc(value) {
  return _toText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function xmlCiiRenderSupportMapperPhase() {
  return `
    <div class="model-converters-workflow-detail-title">6 Support Types</div>
    <div class="model-converters-workflow-detail-text">Map ATT/RVM fields to CII support kinds. Fields and keywords accept comma-separated values; use <code>*</code> to scan all attributes.</div>
    <div id="mc-support-mapper-host" style="overflow:auto;"></div>`;
}

export function bindXmlCiiSupportMapperPhase(detailEl) {
  const host = detailEl?.querySelector('#mc-support-mapper-host');
  if (!host) return;
  try {
    renderSupportMapperPanel(host);
  } catch (e) {
    host.innerHTML = `<div class="model-converters-workflow-detail-note">Support mapper unavailable: ${_esc(e?.message || String(e))}</div>`;
  }
}
