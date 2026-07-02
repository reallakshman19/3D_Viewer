# RVM code 11 facet-group decode evidence

## Purpose

This phase adds evidence-only decoding for RVM primitive code 11 facet groups:

```text
RVM binary
→ RvmWideRecordReaderReport.v1
→ RvmNativeRecordLedger.v1
→ RvmPrimitiveDecodeReport.v1
→ code 11 native facet-group evidence
```

The output is still evidence. It is not a render model and it is not `RvmStageModel.v1`.

## Geometry source policy

RVM binary remains the geometry source. The code 11 decoder re-reads the native `PRIM` record from the original RVM ArrayBuffer and validates the ledger byte range and native code before decoding payload evidence.

ATT is unused in this phase. ATT may become optional future semantic enrichment only; it is not required for native facet evidence.

## Record and payload layout

The decoder uses the established real RVM record layout:

```text
record tag      = wide PRIM
nextOffset      = big-endian uint32 at +16
native code     = big-endian uint32 at +28
payload start   = +32
matrix3x4       = first 12 big-endian float32 values
localBbox       = next 6 big-endian float32 values
facet stream    = bytes after the 18 transform/bbox floats
```

The facet stream preserves native topology evidence:

```text
polygonCount uint32
for each polygon:
  contourCount uint32
  for each contour:
    vertexCount uint32
    repeated vertex records:
      vertex x/y/z float32
      normal x/y/z float32
```

## Evidence shape

Decoded code 11 primitives keep `decodeStatus: decoded-native`, `geometryDecoded: true`, and a `facetGroup` evidence block with:

```text
representation: native-facet-group
polygonCount
contourCount
vertexCount
normalCount
faceCount
vertices
normals
faces
bboxLocal
bboxWorld
diagnostics
```

`faces` preserve polygon/contour index evidence and vertex indices. This phase does not triangulate, optimize, weld vertices, or create Three.js geometry.

## Explicit non-goals

This phase does not implement:

- rendering;
- render instructions;
- `RvmStageModel.v1` emission;
- ATT binding;
- UI integration;
- production 3D RVM Viewer changes;
- code 1, 5, 6, 7, or 10 decoding;
- visual parity claims;
- parser-complete claims.

The report must keep:

```text
parserComplete: false
visualParityClaimed: false
geometryBasis.renderReady: false
```

Code 11 geometry basis uses:

```text
geometryBasis.source: rvm-native-primitive
geometryBasis.confidence: native-facet-evidence
geometryBasis.renderReady: false
```

## Diagnostics

Malformed code 11 payloads become `failed-diagnostic` entries. Unsupported non-scope codes remain `unsupported-diagnostic`. Failures are counted in `failedByCode` and must not be hidden.

## Benchmark runner

The existing primitive benchmark runner now includes a facet-group summary:

```bash
node scripts/bench-rvm-primitive-decoder.mjs /path/to/ASIM-1835.rvm
node scripts/bench-rvm-primitive-decoder.mjs /path/to/ASIM-1835.rvm --out /tmp/asim-1835-primitive-decode.json
```

The printed summary includes `decodedByCode`, `unsupportedByCode`, `failedByCode`, and:

```text
decodedFacetGroupCount
failedFacetGroupCount
totalFacetVertices
totalFacetFaces
maxFacetVerticesPerPrimitive
```
