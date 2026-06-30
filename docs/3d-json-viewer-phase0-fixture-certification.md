# 3D Json Viewer Phase 0.5 Fixture Certification

Phase 0.5 turns the hardened `RvmStageModel.v1` contract into a certified fixture pack for Phase 1 UI and later parser agents. This is not renderer work, not UI work, and not RVM conversion work.

## Why Phase 0.5 exists after contract hardening

Phase 0 hardened the contract, helpers, diagnostics, identity rules, validation, and sample factory. Phase 0.5 exists because Phase 1 needs a plain static fixture that can be loaded without executing a JavaScript factory. The UI shell should prove it can consume `RvmStageModel.v1` data exactly as a future browser worker will emit it.

## Why the static JSON fixture is required before Phase 1 UI

A static JSON fixture gives Phase 1 a deterministic staged-model input. It prevents the UI from depending on parser code, bridge code, hotfix modules, workers, IndexedDB, or Three.js-specific objects. The first UI load path should be simple: load JSON, validate it, render or list it from the staged model, and surface diagnostics.

## How Phase 1 should load the fixture

Phase 1 may read the fixture index, choose `sample-rvm-stage-model-v1`, fetch the JSON referenced by its `href`, parse it as JSON, and pass the parsed object through `validateRvmStageModel()`. The fixture index itself does not perform fetches and does not know about app routing.

A Phase 1 shell should treat the JSON fixture as if it came from the future browser stage worker. It must not parse raw RVM bytes and must not import existing RVM Viewer bridge/hotfix modules.

## Why JSON must match the JS factory output structurally

The JavaScript factory remains useful for tests and programmatic mutation. The JSON fixture is useful for static app loading. They must describe the same contract shape so renderer, hierarchy, properties, diagnostics, and parser agents do not accidentally optimize for one source path only.

The certified JSON fixture must preserve the same top-level model layers:

- schema and source metadata
- hierarchy nodes
- components
- primitives
- geometry chunk references
- diagnostics

It must also preserve the same sample coverage: pipe cylinder, code-4-style elbow, tee, flange, support facet placeholder, foundation box, and unknown diagnostic bbox fallback.

## How invalid fixtures protect future agents

Invalid fixtures intentionally fail validation for one reason each:

- invalid render kind
- invalid bounding box
- semantic-only support geometry
- undecoded native primitive rendered as visible geometry

These fixtures protect future agents from regressing into semantic-only geometry, silent fallback, or visible fake geometry based on names such as `/PS-*`, `SUPPORT`, `TEE`, `FLANGE`, or `VALVE`.

## What a valid Phase 1 load test must prove

A valid Phase 1 load test should prove:

- the sample fixture index contains `sample-rvm-stage-model-v1`
- the index points to a `.json` fixture
- the static JSON parses without comments or functions
- `validateRvmStageModel()` passes
- hierarchy, components, primitives, and diagnostics are visible to the UI shell
- `UNKNOWN_DIAGNOSTIC` and fallback diagnostics are surfaced, not hidden
- no existing RVM Viewer bridge/hotfix module is imported
- no raw RVM parser runs in the UI shell

## Not real RVM conversion

The Phase 0.5 JSON fixture is hand-authored/certified sample data derived from the JS sample factory structure. It is not a real RVM conversion, does not contain raw RVM bytes, does not contain huge vertex arrays, and does not prove parser correctness. Parser and browser-worker agents must later emit the same `RvmStageModel.v1` shape from real inputs and must include diagnostics for every fallback.

## Certification checklist

- [ ] Static JSON fixture parses with `JSON.parse()`.
- [ ] Static JSON fixture validates with `validateRvmStageModel()`.
- [ ] Static JSON fixture contains at least one `UNKNOWN_DIAGNOSTIC` primitive.
- [ ] Static JSON fixture contains at least one fallback diagnostic.
- [ ] Static JSON component and primitive counts match the JS sample factory output.
- [ ] Invalid fixtures fail for their intended `STAGE_*` codes.
- [ ] Sample index resolves known IDs and safely returns no fixture for unknown IDs.
- [ ] No UI, renderer, worker, parser, IndexedDB, Three.js, or existing RVM Viewer bridge/hotfix import is introduced.
