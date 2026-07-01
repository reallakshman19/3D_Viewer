# 3D Json Viewer Phase 4.1 — Real RVM Parser UI Handoff

## Successful parser MVP output

When an RVM binary worker result succeeds and carries a validated `RvmStageModel.v1`, the 3D Json Viewer treats it as staged output. The status reads:

`RVM parsed into staged model`

The model and render plan are passed through the existing staged preview path. The hierarchy, component count, primitive count, diagnostics count, and render-plan count remain the same status fields already used for Stage JSON.

The UI also adds the warning:

`MVP parser slice — not full RVM parity`

This tells users that the current parser path is a validated MVP slice, not complete Navisworks/AVEVA Review parity.

## Diagnostics-only failure

When the worker returns `STAGE_RVM_PARSING_NOT_IMPLEMENTED`, the UI does not claim the RVM was loaded. The status reads:

`RVM diagnostics only — parser could not build staged model`

The diagnostics panel can show preflight, diagnostics report, and parser report summaries when the worker provides them. No fake fallback geometry is rendered.

## Preflight failure

When the worker returns `STAGE_RVM_PREFLIGHT_FAILED`, the UI reports:

`RVM preflight failed`

Only preflight diagnostics are shown. The UI does not imply that parser execution was attempted when preflight blocked the job.

## Why the UI avoids full support claims

RVM parsing is being introduced in controlled slices. A successful MVP parser result proves only that the worker produced a valid staged model for that supported case. It does not prove full RVM native-code coverage, code-11 completeness, or Review/Navis parity.

## Existing staged preview path

This phase does not change parser logic, renderer geometry logic, or stage contracts. Successful binary parser output is handled like any other valid staged worker output: accepted stage model plus render plan in, existing preview renderer out.

## Old viewer isolation

No old 3D RVM Viewer parser, bridge, renderer, hotfix, cache, or IndexedDB code is used. The UI handoff remains staged-model-first and does not decode binary data in the browser UI.
