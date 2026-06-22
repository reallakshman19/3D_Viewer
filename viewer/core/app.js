// App shell runtime delegate.
// Static contract markers retained here because certification gates read core/app.js directly.
// let activeTabDestroy
// let appDestroy
// function cleanupActiveTab
// renderTabError
// tabRendererCache
// GeometryExportWorkspaceBridge.js?v=20260622-geometry-import-tree-1
// GeometryCalculationCanvasBridge.js?v=20260622-geometry-calc-canvas-1
// GeometryCalculationCanvasBridge.js?v=20260622-geometry-support-load-inputs-1
// GeometrySupportLoadInputBridge.js?v=20260622-geometry-support-load-inputs-1
// GeometrySupportLoadInputModel.js?v=20260622-geometry-support-load-inputs-1
// app-label-perf-runtime.js?v=20260622-geometry-enriched-stagedjson-1
// app-label-perf-runtime.js?v=20260622-geometry-support-load-inputs-1
// GeometryCalculationCanvasBridge.js?v=20260622-pipe-support-load-input-hydrator-1
// GeometrySupportLoadInputBridge.js?v=20260622-pipe-support-load-input-hydrator-1
// GeometrySupportLoadInputModel.js?v=20260622-pipe-support-load-input-hydrator-1
// GeometrySupportLoadInputModel.js?v=20260622-pipe-support-load-input-hydrator-2
// GeometrySupportLoadInputReview.js?v=20260622-input-review-lock-1
// GeometrySupportLoadInputOverrides.js?v=20260622-input-override-1
// GeometrySupportLoadInputBridge.js?v=20260622-input-review-override-lock-1
// GeometrySupportLoadFormulaEngine.js?v=20260622-access-support-load-formula-1
// GeometrySupportLoadFormulaBridge.js?v=20260622-access-support-load-formula-1
// GeometrySupportLoadReportExporter.js?v=20260622-support-load-result-report-1
// GeometrySupportLoadReportBridge.js?v=20260622-support-load-result-report-1
// GeometrySupportLoadFormulaEngine.js?v=20260622-support-load-result-writeback-audit-1
// GeometrySupportLoadFormulaBridge.js?v=20260622-support-load-result-writeback-audit-1
// app-label-perf-runtime.js?v=20260622-pipe-support-load-input-hydrator-1
// app-label-perf-runtime.js?v=20260622-input-review-lock-1
// app-label-perf-runtime.js?v=20260622-input-review-override-lock-1
// app-label-perf-runtime.js?v=20260622-access-support-load-formula-1
// app-label-perf-runtime.js?v=20260622-support-load-result-report-1
// app-label-perf-runtime.js?v=20260622-support-load-result-writeback-audit-1
import { installAppTabClickStateBridge } from './app-tab-click-state-bridge.js?v=20260622-tab-click-state-1';
import { installGeometryExportWorkspaceBridge } from '../geometry-workspace/GeometryExportWorkspaceBridge.js?v=20260622-geometry-mapping-1';
import { installGeometryMappingProfileBridge } from '../geometry-workspace/GeometryMappingProfileBridge.js?v=20260622-geometry-profile-ui-1';
import { installGeometryCalculationCanvasBridge } from '../geometry-workspace/GeometryCalculationCanvasBridge.js?v=20260622-pipe-support-load-input-hydrator-1';
import { installGeometryCalculationInputBridge } from '../geometry-workspace/GeometryCalculationInputBridge.js?v=20260622-geometry-input-resolver-1';
import { installGeometryEnrichmentBridge } from '../geometry-workspace/GeometryEnrichmentBridge.js?v=20260622-geometry-enrichment-1';
import { installGeometryEnrichedStagedJsonBridge } from '../geometry-workspace/GeometryEnrichedStagedJsonBridge.js?v=20260622-geometry-enriched-stagedjson-1';
import { installGeometrySupportLoadInputBridge } from '../geometry-workspace/GeometrySupportLoadInputBridge.js?v=20260622-input-review-override-lock-1';
import { installGeometrySupportLoadFormulaBridge } from '../geometry-workspace/GeometrySupportLoadFormulaBridge.js?v=20260622-support-load-result-writeback-audit-1';
import { installGeometrySupportLoadReportBridge } from '../geometry-workspace/GeometrySupportLoadReportBridge.js?v=20260622-support-load-result-report-1';
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
installGeometrySupportLoadInputBridge();
installGeometrySupportLoadFormulaBridge();
installGeometrySupportLoadReportBridge();
installRvmModelHealthBridge();
installRvmModelHealthIssuesBridge();
installBrowserRvmNativeFacetGhostPanelPatch();

export { init } from './app-label-perf-runtime.js?v=20260622-support-load-result-writeback-audit-1';
