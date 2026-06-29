/**
 * Root-level compatibility entry for deployed GitHub Pages import paths.
 *
 * Some live sessions can still resolve the Model Converters tab relative to
 * /3D_Viewer/ instead of /3D_Viewer/viewer/. Keep this module tiny and
 * delegate to the canonical viewer tab entry.
 */
export { renderModelConvertersTab } from '../viewer/tabs/model-converters/index.js?v=20260627-inputxml-cii2019-live-guard-1';
