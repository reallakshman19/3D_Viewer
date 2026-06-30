# 3D Json Viewer — core implementation phases

## Frozen direction

The new **3D Json Viewer** is a clean staged-model viewer. It must not become another bridge/hotfix layer on top of the existing 3D RVM Viewer.

The pipeline is:

```text
RVM / staged input
  -> browser stage worker
  -> RvmStageModel.v1
  -> stage cache
  -> stage renderer
  -> clean 3D Json Viewer UI
```

## Non-negotiable boundaries

1. The 3D Json Viewer must not import existing RVM Viewer bridge/hotfix modules.
2. The UI must not parse RVM binary records.
3. The renderer must not infer geometry from names such as `/PS-*`, `VALVE`, or `TEE` alone.
4. Native decoded geometry has priority over semantic reconstruction.
5. Semantic type is metadata for grouping, icon, search, hierarchy, and fallback; it is not the primary geometry source.
6. Every fallback must be explicit in diagnostics.
7. Every rendered object must carry stable `nodeId`, `componentId`, and `primitiveId` references where applicable.
8. Browser/static page is first priority. CLI is later.

## Core phases

### Phase 0 — Contract freeze

Deliverables:

- `docs/rvm-stage-model-v1-contract.md`
- `docs/rvm-stage-reconstruction-policy.md`
- `viewer/stage/contracts/RvmStageModelContract.js`
- contract validation tests

Purpose: freeze the schema, layers, confidence rules, render kinds, semantic types, and fallback policy before UI work starts.

### Phase 1 — New tab shell

Deliver a standalone **3D Json Viewer** tab with a clean layout:

- top toolbar
- left hierarchy panel
- center Three.js canvas
- right properties/diagnostics panel
- bottom progress/status strip

The tab may use shared app shell conventions, but it must not port the existing RVM Viewer bridge stack.

### Phase 2 — Stage renderer v1

Render only from `RvmStageModel.v1` records. Initial render kinds:

- `CYLINDER`
- `BOX`
- `ELBOW`
- `TEE`
- `FLANGE`
- `FACET_GROUP`
- `SUPPORT_ASSEMBLY`
- `FOUNDATION`
- `STRUCTURAL_MEMBER`
- `UNKNOWN_DIAGNOSTIC`

No raw RVM decoding is allowed inside the renderer.

### Phase 3 — Browser stage worker v1

Worker receives an `ArrayBuffer` and emits:

- progress events
- stage manifest
- hierarchy records
- primitive records
- diagnostics

Initial native primitive coverage:

- code 2 box
- code 4 CircularTorus / elbow
- code 8 cylinder
- code 9 sphere
- code 11 facet group
- unknown-code diagnostic records

### Phase 4 — Hierarchy, IDs, and selection

The tree and canvas must use the same IDs:

- `nodeId` for hierarchy rows
- `componentId` for plant/component groups
- `primitiveId` for native primitive records

Selection must be implemented against the stage registry, not DOM text matching.

### Phase 5 — Component grouping

Create a component assembler that groups native primitives into:

- pipe
- elbow
- tee
- flange
- valve
- support
- foundation
- structural member / T-post
- unknown component

Each group must carry geometry confidence and semantic confidence.

### Phase 6 — IndexedDB stage cache

Cache staged results by:

```text
sha256(file bytes) + schema version + converter version
```

The first conversion may take minutes. Repeat load should use cached stage chunks.

### Phase 7 — Visual Quality as render recipe selection

`Full`, `Medium`, `Light`, `Skeleton`, and `Hidden` must select stage render recipes. It must not mutate arbitrary Three.js objects after rendering.

### Phase 8 — Diagnostics certification

Diagnostics must include:

- primitive counts by native code
- decoded/fallback/unknown counts
- hierarchy node count
- component counts by semantic type
- bbox validity
- render recipe counts
- cache hit/miss status
- warning/error list

## First acceptance milestone

A hand-authored `RvmStageModel.v1` sample must load in 3D Json Viewer and render:

- pipe
- code-4-style elbow
- tee
- flange
- support plate
- foundation box
- unknown diagnostic bbox

with hierarchy, selection, properties, and diagnostics.

## Second acceptance milestone

A browser worker must convert `GAS_2026Apr26-0828.rvm` into diagnostics-only `RvmStageModel.v1` output. Rendering is not required for this milestone.

## Third acceptance milestone

`GAS_2026Apr26-0828.rvm` must render from staged model only. Acceptance requires visible elbows, non-partial tees, no giant semantic support placeholders, stable hierarchy selection, and diagnostics for every fallback.
