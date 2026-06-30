# 3D Json Viewer Phase 3 Worker Shell

This phase adds the first browser worker shell and dry-run runtime for the staged 3D Json Viewer pipeline. It is not an RVM parser and does not render geometry.

## Worker shell, not RVM parser

The runtime accepts `stage-json` jobs and validates an already-staged `RvmStageModel.v1` payload. It does not inspect raw RVM records, decode binary primitive layouts, or infer geometry from semantic names. `rvm-binary` jobs return a controlled `STAGE_RVM_PARSING_NOT_IMPLEMENTED` protocol error until a later parser phase implements real conversion.

## Message lifecycle

A dry-run Stage JSON job emits deterministic protocol messages:

1. `STAGE_WORKER_READY`
2. `STAGE_WORKER_START`
3. `STAGE_WORKER_PROGRESS` for `reading-file`
4. `STAGE_WORKER_PROGRESS` for `building-diagnostics`
5. `STAGE_WORKER_STAGE_READY`
6. `STAGE_WORKER_PACKAGE_READY`

Malformed JSON, invalid staged models, unsupported job kinds, and binary RVM requests emit `STAGE_WORKER_ERROR` with stable error codes.

## Accepted Stage JSON handoff

For valid Stage JSON, the runtime:

- parses JSON text
- validates `RvmStageModel.v1`
- creates a `RvmStagePackageManifest.v1`
- builds a plain `StageRenderPlan.v1` dry-run object from stage primitives and render recipes
- runs `StageWorkerAcceptance`
- returns accepted output with model, manifest, render plan, diagnostics, messages, and acceptance report

The runtime does not import preview-renderer modules. The generated render plan is serializable contract data only.

## Controlled RVM not-implemented failure

The first binary RVM job path is deliberately negative. It returns `ok: false` with code `STAGE_RVM_PARSING_NOT_IMPLEMENTED`. This prevents future agents from faking RVM parsing or silently routing through the existing 3D RVM Viewer parser/bridge stack.

## Browser worker entry

`viewer/stage/worker/stage-worker.js` is a browser Worker entry. It listens with `self.onmessage`, runs the dry-run runtime, streams protocol messages with `self.postMessage`, and posts the final runtime result. It does not use DOM APIs, Three.js, IndexedDB, fetch, UI modules, preview renderer modules, or old RVM Viewer modules.

## Future UI integration

A later UI integration can post a Stage JSON job to this worker shell and display streamed progress. The UI should consume only validated protocol messages and the final accepted result. Real RVM parsing can later replace the controlled not-implemented path while keeping the same protocol and acceptance gates.

## Leakage prevention

This shell imports only staged contracts, staged samples in tests, and the worker runtime. It does not import:

- `viewer/tabs/*`
- `viewer/stage/render/*` from the runtime or worker entry
- `three`
- `indexedDB`
- existing RVM Viewer parser modules
- existing RVM Viewer bridge/hotfix modules
- app shell or routing modules

The staged path remains independent from the old 3D RVM Viewer implementation.
