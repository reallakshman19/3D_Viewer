# RVM-only StageModel emitter

## Purpose

This phase emits the first RVM-only `RvmStageModel.v1` from native RVM evidence:

```text
RVM binary
→ RvmWideRecordReaderReport.v1
→ RvmNativeRecordLedger.v1
→ RvmPrimitiveDecodeReport.v1
→ RvmStageModel.v1
```

The output is a canonical JSON model for future 3D Json Viewer rendering and diagnostics. It is not a renderer and it is not a runtime integration.

## Geometry source policy

RVM binary remains the geometry source. The emitter consumes native evidence from the wide-record reader, native record ledger, and primitive decode report.

ATT is unused in this phase. The emitted model sets:

```text
source.kind: rvm-binary
source.attAvailable: false
source.semanticSource: rvm-only
```

ATT may become optional future semantic enrichment, but it is not required and is not used here.

## Parser status

This phase must not claim full parser completion or visual parity:

```text
parser.parserComplete: false
parser.visualParityClaimed: false
```

No primitive may claim render readiness in this phase.

## Hierarchy mapping

CNTB hierarchy evidence from `RvmNativeRecordLedger.v1` is mapped into stage hierarchy nodes. Node source evidence preserves:

```text
source.kind: rvm-cntb
recordOffset
recordEndOffset
```

The StageModel root is preserved as the model `hierarchy.rootId`. CNTB node parent-child relationships and primitive attachment IDs are preserved for future diagnostics and rendering.

## Primitive mapping

Decoded primitives are represented as StageModel primitives with source evidence:

```text
source.kind: rvm-prim
recordOffset
recordEndOffset
parentPath
```

Codes 2, 4, 8, and 9 preserve native primitive transform, bbox, origin, and native parameters as evidence. Code 9 preserves native diameter plus derived radius evidence.

Code 11 preserves native facet-group evidence:

```text
geometry.basis: rvm-native-facet-group
geometry.confidence: native-facet-evidence
geometry.facetGroup
```

Facet evidence is carried for later StageModel/render-plan work. This phase does not triangulate, create Three.js geometry, or claim visual parity.

Unsupported primitive records for codes 1, 5, 6, 7, and 10 are not dropped. They are emitted as diagnostic StageModel primitives with:

```text
decodeStatus: unsupported-diagnostic
geometryDecoded: false
geometry.confidence: diagnostic
renderKind: UNKNOWN_DIAGNOSTIC
```

## Explicit non-goals

This phase does not implement:

- rendering;
- render instructions;
- UI integration;
- 3D Json Viewer runtime routing;
- ATT binding;
- production 3D RVM Viewer changes;
- decoding for codes 1, 5, 6, 7, or 10;
- visual parity claims;
- parser-complete claims.

## Benchmark runner

A local RVM file can be checked without committing the benchmark file:

```bash
node scripts/bench-rvm-stage-model-emitter.mjs /path/to/ASIM-1835.rvm
node scripts/bench-rvm-stage-model-emitter.mjs /path/to/ASIM-1835.rvm --out /tmp/asim-1835-stage-model.json
```

The runner prints reader record counts, ledger node count, primitive record count, stage node and primitive counts, decoded/unsupported/failed code maps, facet group summary, diagnostics, validation result, parser-complete state, visual-parity state, and ATT availability.

## Future work

A later phase may route the 3D Json Viewer UI to load this StageModel. That later phase must remain separate and must include explicit renderer/runtime acceptance gates.
