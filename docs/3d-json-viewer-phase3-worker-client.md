# 3D Json Viewer Phase 3 Worker Client Adapter

This phase adds a browser-side worker client adapter and a strict `StageWorkerJob.v1` envelope. It prepares UI integration without modifying the 3D Json Viewer tab, preview renderer, parser stack, cache, or app routing.

## Why the worker client is separate from UI

The tab should not invent worker wiring, message collection, timeout behavior, or job envelope rules. The client adapter isolates those concerns in `viewer/stage/worker/` so later UI work can call a small tested API and consume protocol messages plus a final accepted result.

## StageWorkerJob.v1 envelope

`StageWorkerJob.v1` describes the unit of work sent to the worker shell:

- `stage-json` jobs carry staged JSON text and must include a source hash.
- `rvm-binary` jobs carry a binary payload or positive file size and must include a source hash.
- every job has schema, job ID, kind, file name, file size, file hash, and creation timestamp.

The envelope validates input shape only. It does not parse RVM, hash files, fetch data, touch DOM, or create renderer objects.

## Direct runtime mode vs browser Worker mode

Direct runtime mode is for tests and dry runs. The client receives a runtime object and calls `runStageWorkerJob()` directly while collecting protocol messages.

Browser Worker mode is for later UI integration. The client receives a `workerUrl` or `workerFactory`, creates a module worker, listens for `stage-worker-message` events, waits for `stage-worker-result`, and returns the final result with collected messages.

## Message/result lifecycle

A Stage JSON dry run produces protocol messages such as READY, START, PROGRESS, STAGE_READY, and PACKAGE_READY. The final result should contain an accepted staged output with model, manifest, render plan, diagnostics, and acceptance report.

Invalid jobs fail before runtime execution with `STAGE_WORKER_JOB_INVALID`. Malformed JSON or invalid staged models fail through the runtime protocol error path.

## Timeout and dispose behavior

The client accepts `timeoutMs`. If the timeout expires, it returns a controlled `STAGE_WORKER_CLIENT_TIMEOUT` failure. `disposeStageWorkerClient()` is idempotent and terminates an active browser worker when present.

## RVM binary remains not implemented

`rvm-binary` jobs are valid envelopes, but the current worker shell still returns `STAGE_RVM_PARSING_NOT_IMPLEMENTED`. This prevents fake parsing and preserves the staged contract boundary until a real parser phase is approved.

## Integration guidance

Later UI work should:

1. build a `StageWorkerJob.v1` with the helper functions
2. create a worker client with the stage worker URL
3. subscribe to returned protocol messages/results through the client output
4. use accepted worker output only after `validateStageWorkerOutput()` passes
5. show controlled errors for invalid jobs, timeouts, cancellation, or not-implemented binary parsing

The tab should not directly inspect worker internals or bypass job validation.

## What future agents must not bypass

Future agents must not bypass:

- `StageWorkerJob.v1` validation
- worker protocol message validation
- package manifest validation
- `RvmStageModel.v1` validation
- stage worker acceptance gates
- controlled binary not-implemented behavior until parser implementation exists

The client must not import UI modules, preview renderer modules, old RVM Viewer parser/bridge/hotfix modules, Three.js, or cache implementation code.
