# BM_CII restraint source audit workflow

This workflow is intentionally staged. It is the controlled restart path after the failed restraint-symbol implementation. Do not generate or freeze a benchmark GLB until the source audit, frame QC, annotation fidelity QC, generated GLB QC, and visible-scene QC in the Basic GLB-PCF Viewer all pass.

## Purpose

The audit creates the source-truth table for BM_CII support/restraint records:

```text
BM_CII_INPUT.XML + optional ISONOTE sidecar
  -> one normalized support record per source row
  -> resolved pipe frame P/T/R
  -> expected symbol contract
  -> layer metadata expectation
```

The annotation gate creates and validates the source-truth annotation table:

```text
sidecar.caesarAnnotationCallouts only
  -> ISONOTE callouts 1,2,3,4
  -> nodes 35,130,205,255 only
  -> node labels 35,130,205,255 only
  -> unmerged traceable annotation objects for benchmark GLBs
```

The GLB visible-scene gate validates the actual generated glTF scene graph, not just source metadata:

```text
repo-generated GLB
  -> no legacy/orphan support or AXIS nodes physically present
  -> authoritative baked glyph support roots only
  -> support primitives match final OD/2 contracts
  -> ISONOTE callouts and node labels are traceable, unmerged, and whitelisted
```

## Commands

From the repository root:

```bash
node scripts/bm-cii/support-source-audit.mjs \
  --xml "Benchmarks/INPUT XML to CII 2019/BM_CII/BM_CII_INPUT.XML" \
  --sidecar <path-to-sidecar.json> \
  --out-dir artifacts/bm-cii-restraint-audit

node scripts/bm-cii/support-frame-qc.mjs \
  --audit-dir artifacts/bm-cii-restraint-audit
```

After a v11 robust build has produced the sidecar summary:

```bash
node scripts/bm-cii/annotation-fidelity-qc.mjs \
  --sidecar artifacts/bm-cii-v11-robust/BM_CII_Enriched_benchmark_v11_robust.sidecar.json \
  --out artifacts/bm-cii-v11-robust/annotation_fidelity_qc_report.json
```

After a v11 robust build has produced a GLB candidate:

```bash
node scripts/bm-cii/glb-visible-scene-qc.mjs \
  --glb artifacts/bm-cii-v11-robust/BM_CII_engineering_inputxml.glb \
  --expected-source inputxml \
  --expected-support-count 12 \
  --expected-callout-count 4 \
  --expected-node-label-count 4 \
  --out artifacts/bm-cii-v11-robust/glb_visible_scene_qc_inputxml.json
```

For ISONOTE variants, use:

```bash
node scripts/bm-cii/glb-visible-scene-qc.mjs \
  --glb artifacts/bm-cii-v11-robust/BM_CII_engineering_isonote.glb \
  --expected-source isonote \
  --expected-support-count 11 \
  --expected-callout-count 4 \
  --expected-node-label-count 4 \
  --out artifacts/bm-cii-v11-robust/glb_visible_scene_qc_isonote.json
```

If no sidecar is available, `support-source-audit.mjs` uses the explicit BM_CII ISONOTE benchmark fallback table and marks the audit as failed. That is acceptable for source investigation only; it is not acceptable for baseline freeze.

## Output

```text
artifacts/bm-cii-restraint-audit/
  support_expected_from_inputxml.json
  support_expected_from_isonote.json
  support_frame_index.json
  source_audit.summary.json
  source_audit.md
  support_frame_qc_report.json

artifacts/bm-cii-v11-robust/
  BM_CII_Enriched_benchmark_v11_robust.sidecar.json
  BM_CII_Enriched_benchmark_v11_robust.manifest.json
  annotation_fidelity_qc_report.json
  glb_visible_scene_qc_inputxml.json
  glb_visible_scene_qc_isonote.json
```

## Required pass criteria before final GLB freeze

```text
InputXML records = 12
ISONOTE records = 11
all records have resolved P/T/R frame
UNKNOWN records have visibleDefault=false
all support records have exact expectedSymbolContract
all layerIds include plant.restraints + source + kind + axis if source axis exists

annotation source = sidecar.caesarAnnotationCallouts only
ISONOTE callouts = 4
node labels = 4
allowed callout numbers = 1,2,3,4 only
allowed annotation nodes = 35,130,205,255 only
mergeMarkers = false for benchmark annotations
annotation.node layer is present for node labels

GLB declares bmCiiSupportGlyphsAuthoritative
old/orphan nodes are physically absent:
  BM_CII_RESTRAINT_OD2_V19_*
  SUPPORT_ARROW_V7*
  AXIS_X_BLUE*
  AXIS_Y_GREEN*
  AXIS_Z_RED*
  CAESAR_ANNOTATION_OD2_V19_*
GUIDE primitives are lateral only and tip at OD/2
REST primitives are vertical only and tip at OD/2 / pipe surface
LINESTOP/LIMIT primitives are axial and offset from pipe centerline by OD/2
UNKNOWN has no visible support primitives
ISONOTE callouts and node labels are unmerged, traceable objects
```

No GLB should be frozen when any frame is unresolved, when the sidecar source table is missing, when annotation fidelity fails, when GLB visible-scene QC fails, or when the Basic GLB-PCF Viewer runtime lifecycle QC fails.
