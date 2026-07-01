# 3D Json Viewer Phase 3 RVM Binary Preflight

This phase adds a strict RVM binary preflight guard before any real staged-path RVM parser exists. It lets future UI work submit `.rvm` files to the worker safely while still returning controlled diagnostics instead of fake staged geometry.

## Why preflight exists before parsing

The worker already accepts `rvm-binary` job envelopes, but real binary conversion is not implemented. Preflight checks basic source integrity first so the UI can distinguish bad file input from the intentional parser-not-implemented state.

## What preflight checks

The preflight report checks:

- job ID
- file name
- file size
- file hash
- binary byte length
- `.rvm` extension as a warning-only signal
- consistency between declared file size and available byte length
- a very light header sniff that can warn about an unknown header

The report returns `{ valid, errors, warnings, summary }` and does not throw for normal invalid input.

## What is intentionally not checked

Preflight does not:

- scan RVM records
- decode primitive payloads
- build hierarchy
- create `RvmStageModel.v1`
- create render plans
- infer geometry
- call old RVM Viewer parser, renderer, bridge, or hotfix modules

## Why unknown header is warning-only

The staged path has not yet proven a canonical RVM magic/header signature for all supported AVEVA/PDMS/RVM variants. Requiring exact magic now would block valid files prematurely. Therefore an unknown header is reported as `STAGE_RVM_PREFLIGHT_UNKNOWN_HEADER` warning, not a fatal error.

## Runtime behavior

For `rvm-binary` jobs, the worker runtime now:

1. emits `reading-file` progress
2. emits `hashing-source` progress for source validation
3. runs RVM binary preflight
4. returns `STAGE_RVM_PREFLIGHT_FAILED` when preflight is invalid
5. returns `STAGE_RVM_PARSING_NOT_IMPLEMENTED` when preflight passes

The runtime must not emit `STAGE_WORKER_STAGE_READY` or `STAGE_WORKER_PACKAGE_READY` for binary jobs until a real parser exists.

## UI diagnostics guidance

The UI should display preflight errors as file/input problems. It should display valid preflight followed by `STAGE_RVM_PARSING_NOT_IMPLEMENTED` as an expected dry-run limitation, not as a crash. Warnings such as non-`.rvm` extension or unknown header should be visible but not treated as parser failures.

## Future parser guardrails

Future parser agents must not bypass:

- `StageWorkerJob.v1` validation
- `StageRvmBinaryPreflight` validation
- worker protocol messages
- worker acceptance gates
- `RvmStageModel.v1` validation
- render recipe and render plan validation

Parser agents must not silently reuse old RVM Viewer bridge/parser behavior to create staged output.

## Independence from old RVM Viewer stack

This preflight layer is independent from the old 3D RVM Viewer stack. It does not import existing parser, renderer, bridge, hotfix, Three.js, UI tab, app shell, cache, or IndexedDB modules.
