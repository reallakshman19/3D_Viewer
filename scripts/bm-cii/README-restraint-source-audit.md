# BM_CII restraint source audit workflow

This workflow is intentionally **pre-GLB**. It is the controlled restart path after the failed restraint-symbol implementation. Do not generate or freeze a benchmark GLB until this audit passes and the generated GLB later passes visible-scene QC in the Basic GLB-PCF Viewer.

## Purpose

The audit creates the source-truth table for BM_CII support/restraint records:

```text
BM_CII_INPUT.XML + optional ISONOTE sidecar
  -> one normalized support record per source row
  -> resolved pipe frame P/T/R
  -> expected symbol contract
  -> layer metadata expectation
```

It does **not** build GLB files.

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
```

## Required pass criteria before any GLB generation

```text
InputXML records = 12
ISONOTE records = 11
all records have resolved P/T/R frame
UNKNOWN records have visibleDefault=false
all support records have exact expectedSymbolContract
all layerIds include plant.restraints + source + kind + axis if source axis exists
```

No GLB should be generated when any frame is unresolved or when the sidecar source table is missing.
