# 3D Json Viewer Phase 3.9 — RVM Diagnostics-Only Record Scanner

## Scope

This phase adds a conservative diagnostics-only binary scanner for the staged worker RVM path. It is not an RVM parser. It does not produce `RvmStageModel.v1`, render plans, geometry chunks, meshes, canvas objects, or preview geometry.

The scanner only inspects safely bounded byte ranges and only reports candidate record signatures and candidate native-code statistics when they can be detected without decoding a full binary layout.

## Why the worker still returns `STAGE_RVM_PARSING_NOT_IMPLEMENTED`

A diagnostics report is useful for handoff and benchmark preparation, but it is not a parsed model. The worker therefore continues to return a controlled failure with code `STAGE_RVM_PARSING_NOT_IMPLEMENTED` after valid RVM preflight. The new difference is that the failure context includes `rvmDiagnosticsReport`.

This keeps the UI and worker boundary honest: the binary was inspected, but no model was accepted.

## Reliable versus candidate counts

Reliable fields are limited to source identity and byte length, because those come from the job envelope and preflight.

Candidate fields include:

- ASCII signatures such as `CNTB`, `CNTE`, and `PRIM` when detected in the byte stream.
- Candidate hierarchy depth inferred from conservative `CNTB`/`CNTE` pairs.
- Candidate native primitive code counts when a small bounded numeric field can be read near a candidate `PRIM` signature.
- Candidate bbox records only when a bounded `BBOX` marker and six finite float values are present.

These counts are diagnostics, not proof of a decoded RVM model. Unknown layout areas are reported through warnings and `undecodedRecords` rather than guessed.

## Why no stage model is produced

A valid staged model requires hierarchy, components, primitives, native provenance, transform/bounds, diagnostics, and render policy contracts. A signature scan does not prove enough of that structure. Producing `RvmStageModel.v1` here would create a false parser boundary.

## Why no geometry or rendering is produced

The scanner does not decode primitive payloads or mesh chunks. Candidate native code 4 or code 11 can be counted, but not rendered. Geometry chunk creation is reserved for a later parser/decoder phase that can validate payload offsets, transforms, bounds, and chunk metadata.

## Future parser and GAS/RMSS benchmark use

Future parser agents can use this scanner as a baseline safety layer: preflight first, diagnostics scan second, parser third. GAS/RMSS benchmark acceptance can later compare candidate code counts and record signatures before full conversion logic is enabled.

This helps detect regressions such as missing code-4 elbows or code-11 mesh/facet blocks without pretending that the current phase can render them.

## Old viewer isolation

This scanner imports no old 3D RVM Viewer bridge, parser, renderer, hotfix, cache, UI, or Three.js code. It is staged-worker diagnostics only and keeps the staged-model boundary intact.
