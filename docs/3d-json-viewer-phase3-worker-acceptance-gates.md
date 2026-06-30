# 3D Json Viewer Phase 3 Worker Acceptance Gates

These gates define how future Phase 3 browser-worker output is certified before the UI or renderer consumes it. They are contract, sample, test, and documentation gates only; they do not implement a worker, parser, renderer, UI, cache, IndexedDB, or existing RVM Viewer bridge path.

## Why acceptance gates exist before worker implementation

The browser worker will eventually read source data, emit progress events, build `RvmStageModel.v1`, produce diagnostics, and hand off a package manifest. Without acceptance gates, parser and worker agents could emit partial or ad-hoc structures that the UI accepts accidentally. These gates force every successful worker handoff to pass the same staged-model, package, diagnostics, recipe, and render-plan contracts before consumption.

## Successful worker handoff requirements

A successful handoff must contain:

- valid worker protocol messages
- at least one `STAGE_WORKER_START` message
- at least one terminal success message, especially `STAGE_WORKER_STAGE_READY`
- valid `RvmStageModel.v1`
- valid stage diagnostics in or attached to the model
- valid stage package manifest
- source/cache identity consistency
- render-recipe-compatible primitives and components
- a valid `StageRenderPlan.v1`, or enough model data to build one with full quality

The acceptance report returns `{ valid, errors, warnings, summary }` and must not throw for ordinary invalid worker output.

## Failed or cancelled handoff requirements

A failed or cancelled handoff may omit `stageModel`, `manifest`, diagnostics, and render plan. It must still include valid worker protocol messages, a start message, and a terminal error or cancelled message.

Failures should use `STAGE_WORKER_ERROR` with a stable `message`, `code`, and `context`. Cancellation should use `STAGE_WORKER_CANCELLED` with serializable payload data. The UI can display these states without trying to render invalid or missing staged geometry.

## How UI should treat accepted vs rejected output

Accepted successful output may be handed to the stage loader, render-plan adapter, diagnostics panel, and renderer. Rejected output must not be rendered as a model. The UI should show acceptance errors and warnings, including missing diagnostics, invalid package references, invalid protocol messages, identity mismatches, or invalid render-plan data.

Failed or cancelled accepted output is not renderable model output. It is accepted only as a valid failure/cancellation envelope so the UI can show a deterministic error or cancellation state.

## Diagnostics and fallback certification

Fallback geometry must not silently disappear. If the staged model contains diagnostic/fallback primitives such as `UNKNOWN_DIAGNOSTIC`, undecoded native primitives, or diagnostic-confidence primitives, the model diagnostics must include fallback diagnostic messages. Supplying diagnostics outside the staged model may be warned because renderer/UI handoff should keep diagnostics with the model.

## Why render-plan validation is part of acceptance

The renderer consumes a render plan, not raw parser internals. Acceptance therefore validates the supplied `StageRenderPlan.v1` or builds a full-quality plan from the staged model and validates that plan. This proves the worker output is compatible with render recipes and the render-plan contract before a renderer agent touches it.

## Preventing staged-model bypass

Future worker/parser agents must not bypass:

- worker protocol validation
- package manifest validation
- `RvmStageModel.v1` validation
- diagnostics/fallback validation
- render recipe validation
- render-plan validation
- source/cache identity checks

Any direct handoff of raw RVM records, parser-private objects, bridge objects, or Three.js objects is outside the accepted Phase 3 contract.

## Independence from old RVM Viewer bridge/parser stack

These gates do not import old RVM Viewer bridge/hotfix modules, parser modules, renderer modules, tab files, or app shell code. They certify plain staged JSON contracts and render-plan compatibility. This keeps the new 3D Json Viewer pipeline independent from legacy bridge/hotfix rendering behavior.

## Forbidden for future worker/parser agents

Agents must not:

- implement real parsing in acceptance modules
- emit Three.js objects from worker output
- touch DOM or UI tabs
- import existing RVM Viewer bridge/hotfix modules
- write IndexedDB/cache code in this phase
- hide fallback diagnostics
- invent geometry from semantic names alone
- skip package/model/render-plan validation
- couple progress messages to parser-private state

## Acceptance summary fields

Acceptance summaries should expose enough data for tests and UI diagnostics:

- message count
- terminal message type
- model primitive count
- component count
- package artifact count
- render plan entry count

These fields make handoff quality observable without coupling the UI to parser internals.
