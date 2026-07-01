# 3D Json Viewer Phase 4.3B — Code 4 Parser-to-Stage Integration

## Scope

This phase integrates the Phase 4.3A code-4 decoder into the existing MVP binary parser path. It is synthetic MVP integration only. It does not prove real GAS/RMSS compatibility, AVEVA Review parity, Navis parity, or full native code-4 support.

## Record-reader evidence flow

The parser first calls the bounded record-reader evidence layer. The record reader reports candidate `CNTB`, `CNTE`, and bounded `PRIM` payload slices. Parser integration consumes only bounded PRIM slices and checks the candidate native code before decoding.

For candidate native code 4 slices, the parser calls `decodeRvmCode4ElbowPayload()`. The decoder accepts only the supported synthetic MVP layout and returns a decode report with `decoderComplete: false` and `visualParityClaimed: false`.

## Mapping decoded code 4 into staged ELBOW

When code-4 decode succeeds, the parser emits a staged primitive with:

- `renderKind: "ELBOW"`
- `native.code: 4`
- `nativeRecord.recordType: "RVM_PRIMITIVE"`
- `nativeRecord.nativeCode: 4`
- `nativeRecord.decoded: true`
- `nativeGeometry.provenance: "native"`
- `nativeGeometry.nativeParams` from the decoder
- `nativeGeometry.transform3x4` from the decoder
- `nativeGeometry.bboxLocal` from the decoder
- `nativeGeometry.bboxWorld` from the decoder
- `confidence.geometry: "native"`
- `recipeSource.source: "native"`

These fields satisfy the render-readiness contract from Phase 4.2B.

## Failed decode remains diagnostic

If the decoder rejects a code-4 payload, the parser does not guess geometry from the native code or bbox. It emits the existing diagnostic fallback path using `UNKNOWN_DIAGNOSTIC` so the UI and renderer remain honest.

## Code 11 remains blocked

This phase does not decode code 11, does not create mesh/facet output, and does not create geometry chunks. Unsupported primitive candidates remain diagnostic.

## Parser completion and visual parity remain false

`parserComplete` remains false because this is not a full RVM parser. `visualParityClaimed` remains false because synthetic fixtures do not prove Review/Navis/GAS/RMSS parity.

## Old viewer isolation

No old 3D RVM Viewer parser, bridge, renderer, hotfix, UI, style, cache, IndexedDB, or browser 3D-library dependency is imported into the integration path.
