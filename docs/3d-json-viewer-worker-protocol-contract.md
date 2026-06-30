# 3D Json Viewer Worker Protocol Contract

This document defines the Phase 0.9 browser worker handoff contract before any real worker, parser, cache, or renderer implementation begins.

## Why the protocol exists before worker implementation

The future browser stage worker must emit predictable `RvmStageModel.v1` artifacts and observable progress. Defining the package manifest and message protocol first prevents Phase 3 from coupling UI behavior to parser internals, bridge hotfixes, or ad-hoc worker events.

This phase defines contracts only. It does not parse RVM, start a Web Worker, write cache entries, render Three.js objects, or touch UI files.

## UI thread and worker boundary

The UI thread owns user interaction, progress display, cancellation requests, sample loading, and presentation of diagnostics. The worker side owns staged conversion work later: file reading, hashing, parsing, hierarchy building, primitive decoding, component grouping, diagnostics construction, and package emission.

The boundary between them is message data. The UI must not depend on parser-private variables, record iterators, bridge state, or worker implementation details.

## Worker must not touch DOM

The worker contract is DOM-free. A future worker must not access document, window, MutationObserver, tab modules, app shell modules, or any DOM helper. It communicates progress and results through serializable messages only.

## Worker emits stage artifacts, not Three.js objects

The worker output is `RvmStageModel.v1` plus a package manifest, diagnostics, and optional chunk references. It must not emit Three.js materials, meshes, scenes, groups, cameras, or renderer-specific classes.

Renderer agents must consume the staged model and render recipes after the handoff. Parser/worker agents must not decide scene object behavior.

## Progress lifecycle

The worker protocol defines deterministic phases:

1. `idle`
2. `reading-file`
3. `hashing-source`
4. `parsing-records`
5. `building-hierarchy`
6. `decoding-primitives`
7. `building-components`
8. `building-diagnostics`
9. `writing-package`
10. `complete`
11. `failed`
12. `cancelled`

Progress messages include `loaded`, `total`, `percent`, `phase`, and a human-readable message. Percent must stay between 0 and 100. When `total` is finite, `loaded` must not exceed `total`.

## Diagnostics handoff

Diagnostics must be serializable contract data. The worker may emit diagnostic messages during conversion and must include final diagnostics in the staged model/package. Every fallback, unknown native code, undecoded primitive, and diagnostic-only object must remain explainable through `RvmStageDiagnostics.v1` data.

## Package manifest handoff

The package manifest tells the UI which artifacts and chunks exist. The initial JSON-only phase can have no chunks. Future phases can add chunk references for geometry, bbox data, selection indices, and string tables without changing the top-level handoff model.

The manifest contains:

- source identity
- stage schema
- artifact references
- chunk references
- diagnostics reference
- cache identity

It does not fetch files and does not contain raw RVM bytes.

## Cancellation and error behavior

Cancellation should produce `STAGE_WORKER_CANCELLED`. Failures should produce `STAGE_WORKER_ERROR` with a stable message, code, and context object. Normal invalid messages are validation failures and must return `{ valid, errors }`; validation must not throw for normal bad protocol data.

## Future cache key identity

The package manifest cache key combines source hash, stage schema, and converter/package version. That identity prepares a future IndexedDB or static cache implementation without introducing cache code in Phase 0.9.

## How this prepares Phase 3

Phase 3 can implement a browser worker against these contracts. The worker will read inputs, emit progress messages, build `RvmStageModel.v1`, write artifacts/chunk references, and hand the UI a package manifest. The UI can remain responsive and observable without knowing parser internals.

## Forbidden for worker agents

Worker/parser agents must not:

- touch DOM or UI tab modules
- emit Three.js objects
- import existing RVM Viewer bridge/hotfix modules
- depend on renderer internals
- parse RVM in UI files
- write cache or IndexedDB code before the cache phase
- bypass `RvmStageModel.v1`
- silently swallow diagnostics
- invent geometry from semantic names alone

## Contract-only boundary

`StagePackageManifest.js` and `StageWorkerProtocol.js` are pure contract modules. They must remain free of DOM, Web Worker globals, Three.js, RVM parser imports, existing RVM Viewer imports, IndexedDB, fetch, app shell imports, and renderer dependencies.
