# 3D Json Viewer Phase 4.0 RVM Parser MVP Vertical Slice

This phase adds the first real RVM parser vertical slice for the staged 3D Json Viewer path. It is intentionally narrow and evidence-driven.

## Why this is the first real parser slice

Previous RVM binary work stopped at preflight and diagnostics-only scanning. This phase adds a bounded parser path that can build a valid `RvmStageModel.v1` from a supported synthetic MVP binary fixture and allows the worker to emit stage/package ready only after model validation passes.

## Supported scope

The MVP parser:

- reads binary input through bounded `DataView` reads
- finds conservative `CNTB`, `CNTE`, and `PRIM` candidates
- requires balanced CNTB/CNTE evidence for the MVP success path
- decodes only a small supported primitive subset
- currently supports code 8 cylinder only when the payload layout evidence is sufficient
- creates a minimal hierarchy, material set, components, primitives, diagnostics, manifest, and render plan through the staged worker path

## Explicit non-goals

This is not full AVEVA Review RVM support and does not claim Navis/Review parity. It does not decode code 11 mesh/facet payloads, does not generate geometry chunks, does not create native geometry from names, and does not import legacy viewer parser, bridge, renderer, or hotfix modules.

## Why `parserComplete` remains false

The parser report has `parserComplete: false` because the implementation is a vertical slice, not a complete RVM parser. It proves a narrow contract path and supported code 8 evidence only.

## Why `visualParityClaimed` remains false

The parser report has `visualParityClaimed: false` because matching Review/Navis visuals requires broad native record support, transforms, hierarchy semantics, meshes, material handling, and benchmark validation that are outside this MVP.

## Why code 11 is not decoded

Code 11 facet/mesh output requires validated geometry chunk metadata and real payload decoding. This MVP blocks code 11 rendering and leaves it as diagnostic fallback until a future parser phase provides verified chunk metadata.

## Unsupported primitives become diagnostics

Unsupported or undecoded primitive candidates become `UNKNOWN_DIAGNOSTIC` primitives with diagnostic fallback. They must not be treated as native/full geometry and must not be inferred from semantic names.

## Worker stage/package ready rules

The worker may emit `STAGE_WORKER_STAGE_READY` and `STAGE_WORKER_PACKAGE_READY` only when:

1. binary preflight is valid
2. diagnostics scanner runs
3. MVP parser returns `ok: true`
4. the generated stage model passes `validateRvmStageModel()`
5. manifest and render-plan handoff pass worker acceptance

If evidence is insufficient, the worker keeps returning `STAGE_RVM_PARSING_NOT_IMPLEMENTED` and includes preflight, diagnostics, and parser reports.

## Future GAS/RMSS parser work

Future real benchmark work should extend record evidence, hierarchy recovery, native code decoding, transforms, bounds, and geometry chunk support without bypassing staged contracts. GAS/RMSS compatibility must be proven by diagnostics and fixture evidence before visual claims.
