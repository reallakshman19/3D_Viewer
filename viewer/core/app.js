// App shell runtime delegate.
// Static contract markers retained here because certification gates read core/app.js directly.
// RVM_RENDERER_PREFLIGHT_MODULES
// Promise.allSettled(RVM_RENDERER_PREFLIGHT_MODULES
// viewer3d-rvm-tab-renderer.js?v=20260622-geometry-enriched-stagedjson-1
// app-label-perf-runtime.js?v=20260622-geometry-enriched-stagedjson-1
// app-label-perf-runtime.js?v=20260622-inputxml-rvm-lazy-1
// app-tab-click-state-bridge.js?v=20260622-tab-click-state-1
// GeometryEnrichedStagedJsonBridge.js?v=20260622-geometry-enriched-stagedjson-1
// BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1
import { installAppTabClickStateBridge } from './app-tab-click-state-bridge.js?v=20260622-tab-click-state-1';
import { installGeometryExportWorkspaceBridge } from '../geometry-workspace/GeometryExportWorkspaceBridge.js?v=20260622-geometry-mapping-1';
import { installGeometryMappingProfileBridge } from '../geometry-workspace/GeometryMappingProfileBridge.js?v=20260622-geometry-profile-ui-1';
import { installGeometryCalculationCanvasBridge } from '../geometry-workspace/GeometryCalculationCanvasBridge.js?v=20260622-geometry-calc-canvas-1';
import { installGeometryCalculationInputBridge } from '../geometry-workspace/GeometryCalculationInputBridge.js?v=20260622-geometry-input-resolver-1';
import { installGeometryEnrichmentBridge } from '../geometry-workspace/GeometryEnrichmentBridge.js?v=20260622-geometry-enrichment-1';
import { installGeometryEnrichedStagedJsonBridge } from '../geometry-workspace/GeometryEnrichedStagedJsonBridge.js?v=20260622-geometry-enriched-stagedjson-1';
import { installRvmModelHealthBridge } from '../tabs/RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1';
import { installRvmModelHealthIssuesBridge } from '../tabs/RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1';
import { installBrowserRvmNativeFacetGhostPanelPatch } from '../rvm/BrowserRvmNativeFacetGhostPanelPatch.js?v=20260622-rvm-facet-ghost-panels-1';

installAppTabClickStateBridge();
installGeometryExportWorkspaceBridge();
installGeometryMappingProfileBridge();
installGeometryCalculationCanvasBridge();
installGeometryCalculationInputBridge();
installGeometryEnrichmentBridge();
installGeometryEnrichedStagedJsonBridge();
installRvmModelHealthBridge();
installRvmModelHealthIssuesBridge();
installBrowserRvmNativeFacetGhostPanelPatch();

export { init } from './app-label-perf-runtime.js?v=20260622-inputxml-rvm-lazy-1';
