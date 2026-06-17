# BM_CII Support / Annotation / Component Panel Cleanup Tracker

Branch: `SupportAnnotationPanelCleanupv1`

## Scope

Stabilize BM_CII InputXML Basic GLB review so the Basic GLB-PCF Viewer can be trusted for component properties, support/restraint symbols, node labels, ISONOTE boards, and ISONOTE-based restraint validation.

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| 0. Baseline freeze | In progress | BM_CII manifest remains strict: no generic/procedural fallback. |
| 1. Component panel data correctness | Implemented | Panel reads resolved metadata and rejects provenance as Line No. |
| 2. Component panel UI cleanup | Implemented initial pass | Engineering fields grouped; raw metadata moved to closed debug details. |
| 3. ISONOTE annotation cleanup | Pending GLB generator pass | Requires next GLB run to bake final readable ISONOTE boards. |
| 4. ISONOTE restraint validation | Implemented report/script | Static validation compares ISONOTE intent against approved InputXML restraint table. |
| 5. Layer panel cleanup | Pending | Needs canonical layer registry pass after annotation board finalization. |
| 6. BM_CII quick mock / repo GLB workflow | Partially implemented | Loader is strict; exact binary GLB still must be placed under `viewer/test/bm-cii/latest/`. |
| 7. Regression tests | Pending | Add test cases after final branch implementation stabilizes. |

## Key Rules Locked

- `Line No.` must only come from approved line-number fields or `BM_CII_LINE_NO_sideload`.
- Provenance/debug trace must never display as `Line No.`.
- Component/process carry-forward is allowed only for component properties.
- Restraint/support records are record-scoped; no carry-forward is allowed for restraints.
- ISONOTE display text must use the sideloaded source text exactly.
- BM_CII quick mock must not load a generic GLB or procedural substitute.

## Current Validation Summary

`benchmarks/bm-cii/BM_CII_isonote_restraint_validation.md` currently reports:

- Node 35: `MISSING_IN_INPUTXML` for GUIDE and LINE STOP intent.
- Node 130: `PASS` for REST NOT DEFINED and single-axis Z intent.
- Node 255: `PASS` for REST and GUIDE intent.
- Node 205: `MISSING_IN_INPUTXML` for GUIDE intent; HOLDDOWN/spring requires engineering review.

These are validation findings, not automatic drawing fixes.
