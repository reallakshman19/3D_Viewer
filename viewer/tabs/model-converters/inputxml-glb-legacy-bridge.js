// Deprecated rich-GLB bridge intentionally disabled.
// The Model Converter tab must route BM_CII InputXML support/annotation work through
// bm-cii-support-annotation-popup.js only. This module is kept as a harmless no-op
// so older cached imports do not re-add the retired "InputXML→GLB Rich 3D Model"
// option or intercept the Run Conversion button.

const TRACE_PREFIX = '[BM_CII_CONVERTER_TRACE]';

export function installInputXmlGlbLegacyBridge(root = globalThis.document) {
  try {
    const select = root?.querySelector?.('#model-converters-select');
    const staleOption = select?.querySelector?.('option[value="inputxml_to_glb"]');
    if (staleOption) staleOption.remove();
    console.warn(`${TRACE_PREFIX} deprecated rich GLB legacy bridge skipped`, {
      removedStaleOption: Boolean(staleOption),
      selectValue: select?.value || '',
      options: Array.from(select?.options || []).map((option) => option.value),
    });
  } catch {}
  return () => {};
}
