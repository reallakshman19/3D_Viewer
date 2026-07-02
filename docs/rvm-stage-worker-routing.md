# RVM Stage Worker evidence routing

## Purpose

This phase routes staged worker `rvm-binary` jobs through the RVM-only evidence pipeline:

```text
RVM upload
→ readRvmWideRecords()
→ buildRvmNativeRecordLedger()
→ buildRvmPrimitiveDecodeReport()
→ buildRvmStageModelFromEvidence()
→ validateRvmStageModelFromEvidence()
→ worker output
```

The worker no longer sends valid wide-tag RVM binaries through the old MVP parser path as the main implementation path.

## Why the old path failed

The old staged worker RVM path used conservative preflight/sniffing plus the MVP binary parser. Real AVEVA-style RVM files use wide tags such as `HEAD` encoded as big-endian uint32 characters. Light ASCII sniffing can misclassify that shape, and the old MVP parser returned `STAGE_RVM_PARSING_NOT_IMPLEMENTED` for valid wide-tag RVM binaries.

## New route

The new worker route keeps preflight source checks, then runs the native evidence chain and returns a normal staged worker package when the emitted StageModel validates:

```text
STAGE_WORKER_STAGE_READY
STAGE_WORKER_PACKAGE_READY
ok: true
stageModel.schema: RvmStageModel.v1
stageModel.source.kind: rvm-binary
stageModel.source.attAvailable: false
stageModel.parser.parserComplete: false
stageModel.parser.visualParityClaimed: false
```

This is still a dry-run staged output. It is not UI integration and it is not rendering.

## Input distinctions

### RVM binary import

Use the `rvm-binary` worker job path for `.rvm` files. RVM binary remains the geometry source.

### RvmStageModel.v1 JSON

Use the `stage-json` worker job path only for valid `RvmStageModel.v1` JSON.

### ATT-managed hierarchy JSON

ATT-managed hierarchy JSON is not accepted as StageModel. A JSON array shaped like:

```json
[
  {
    "name": "/LINE/B1",
    "type": "BRANCH",
    "children": []
  }
]
```

fails with:

```text
STAGE_JSON_ATT_MANAGED_HIERARCHY_NOT_STAGE_MODEL
```

Message:

```text
This JSON is an ATT-managed hierarchy export, not RvmStageModel.v1. Load a valid RvmStageModel.v1 JSON, or import the RVM binary through the RVM evidence pipeline.
```

This PR does not convert ATT-managed hierarchy into StageModel.

## Non-goals

This phase does not implement:

- UI routing;
- rendering;
- ATT binding;
- production 3D RVM Viewer changes;
- model converter changes;
- decoding for codes 1, 5, 6, 7, or 10;
- parser-complete claims;
- visual parity claims.

The emitted StageModel keeps:

```text
source.attAvailable: false
parser.parserComplete: false
parser.visualParityClaimed: false
```

No worker-produced StageModel should claim `renderReady:true` in this phase.

## Future work

A later UI integration phase may route the 3D Json Viewer tab to this worker path. That must be a separate PR with UI/runtime acceptance gates.
