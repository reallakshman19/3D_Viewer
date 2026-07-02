# RVM primitive payload decoder evidence phase

## Purpose

This phase adds the next evidence layer after the native record ledger:

```text
RVM binary
→ RvmWideRecordReaderReport.v1
→ RvmNativeRecordLedger.v1
→ primitive payload decoder
→ RvmPrimitiveDecodeReport.v1
```

The output is primitive geometry evidence only. It is not a renderer and it is not a `RvmStageModel.v1` emission path.

## Geometry source policy

RVM binary remains the geometry source for this phase. The decoder reads each `PRIM` record payload directly from the original RVM ArrayBuffer and validates the wide-tag header against the native record ledger.

ATT is intentionally unused. ATT may become optional semantic enrichment in a later phase, but it is not required for native primitive payload evidence and must not be treated as geometry source here.

## Payload layout

For supported PRIM records, the decoder uses the observed production parser layout:

```text
record tag      = wide PRIM
nextOffset      = big-endian uint32 at +16
major/minor     = big-endian fields at +20/+24
native code     = big-endian uint32 at +28
payload floats  = big-endian float32 values from +32
matrix3x4       = first 12 floats
localBbox       = next 6 floats
native params   = remaining floats
```

The 3x4 transform and local bbox are decoded into world bbox evidence without importing Three.js or producing render instructions.

## Supported codes in this phase

This phase decodes selected primitive evidence:

- code 2 — Box: size evidence from local bbox
- code 4 — CircularTorus / elbow basis: offset, radius, angle evidence
- code 8 — Cylinder: radius and height evidence
- code 9 — Sphere: native diameter evidence plus derived radius evidence

Code 4 evidence does not claim final elbow visual parity. It only proves native transform, bbox, and parameter extraction.

Code 9 preserves the native sphere parameter as `diameter` and exposes `radius = diameter / 2` with `radiusSource: derived-from-native-diameter`. This keeps the evidence aligned with the production parser while still giving downstream consumers a radius convenience field.

## Unsupported codes

Other codes remain diagnostic-only, including facet group code 11. They are represented in `unsupportedPrimitives` with:

```text
decodeStatus: unsupported-diagnostic
geometryDecoded: false
```

Payload mismatches, bad offsets, or native-code mismatches are represented as failed diagnostics, not silent success.

## Explicit non-goals

This phase does not implement:

- `RvmStageModel.v1` emission
- rendering
- render instructions
- UI changes
- production 3D RVM Viewer replacement
- ATT enrichment
- code 11 facet group decoding
- visual parity claims
- parser-complete claims

The report must keep:

```text
parserComplete: false
visualParityClaimed: false
```

Decoded entries use:

```text
geometryBasis.source: rvm-native-primitive
geometryBasis.confidence: native-evidence
geometryBasis.renderReady: false
```

## Benchmark runner

A local RVM file can be checked without committing the benchmark file:

```bash
node scripts/bench-rvm-primitive-decoder.mjs /path/to/ASIM-1835.rvm
```

To write the reader report, native ledger, and decode report:

```bash
node scripts/bench-rvm-primitive-decoder.mjs /path/to/ASIM-1835.rvm --out /tmp/asim-1835-primitive-decode.json
```

The runner prints primitive record count, decoded count, unsupported count, failed count, per-code coverage, parser-complete state, visual-parity state, and warning/error counts.
