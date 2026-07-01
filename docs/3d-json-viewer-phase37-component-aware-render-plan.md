# 3D Json Viewer Phase 3.7 — Component-Aware Render Plan Contract

## Why primitive-only planning is insufficient

The early 3D Json Viewer preview could plan one render entry per native primitive because the first supported visuals were simple procedural proxies: cylinders, boxes, elbows, facet proxies, diagnostic boxes, and hidden entries. That is not enough for industrial model review. Valves, pipe supports, foundations, flanges, T-posts, structural members, and future chunked mesh/facet outputs are not just isolated primitive records. They need component or assembly-level planning before a renderer can safely claim a visual.

Phase 3.7 keeps the current primitive preview compatible, but hardens `StageRenderPlan.v1` so later agents can add component/assembly renderers without changing the contract shape again.

## Entry kinds

`StageRenderPlan.v1` now distinguishes four entry kinds:

- `primitive`: a current renderer-compatible entry for a single staged primitive.
- `component`: a component-level planning entry. This can represent a valve, support, foundation, structural member, or other higher-level item, but it must not claim support unless a real component recipe exists.
- `assembly`: an assembly-level planning entry for future grouped or system-level visual output.
- `diagnostic`: a non-visual or diagnostic-only entry used to explain missing support, invalid geometry metadata, or unsupported output claims.

Every entry carries a stable `sourceRef`, IDs, `renderKind`, `semanticType`, `recipeSource`, `supportLevel`, `output`, `diagnosticOnly`, `hidden`, `bboxWorld`, and `reasonCodes`.

## Unsupported kinds stay diagnostic or hidden

The contract explicitly marks the current renderer gaps as incomplete:

- `TEE`
- `FLANGE`
- `VALVE_ASSEMBLY`
- `SUPPORT_ASSEMBLY`
- `FOUNDATION`
- `STRUCTURAL_MEMBER`
- `MESH_CHUNK`

These entries may appear in component-aware plans, but they must be `diagnostic-only`, `unsupported`, or `hidden` unless a later renderer adds an explicit recipe and metadata path. This prevents the UI from drawing fake component geometry that looks authoritative.

## No fake visuals from semantic names

The plan must not create visual geometry from path strings, owner paths, line names, or semantic labels. A word like valve, support, or foundation is not enough to define dimensions, topology, orientation, nozzles, bolts, legs, plates, or mesh data. The render planner can record the unsupported intent and diagnostics, but it cannot infer geometry from naming conventions.

## Geometry chunk and facet preparation

`MESH_CHUNK` is reserved for future code-11 or chunked mesh rendering. A non-diagnostic mesh output must include geometry chunk metadata before it can be valid.

`FACET_GROUP` remains compatible with the current preview proxy, but native/full output claims require decoded facet metadata or chunk metadata. Without that metadata, the plan must fall back to diagnostic output.

## Current preview compatibility

`buildStageRenderPlan(model, quality)` remains primitive-compatible. It emits entries the existing Three preview renderer already understands. Component and assembly entries are introduced through `buildComponentAwareStageRenderPlan(model, quality, options)` so the UI renderer does not unexpectedly receive unsupported component visuals.

The existing preview behavior for `CYLINDER`, `BOX`, `ELBOW`, `FACET_GROUP`, `UNKNOWN_DIAGNOSTIC`, and `hidden` is preserved.

## Boundary from old RVM viewer code

This phase adds no parser and no renderer expansion. It imports no old RVM Viewer bridge, hotfix, parser, renderer, cache, or worker logic. The contract remains staged-model-first: the render plan describes what can and cannot be rendered from `RvmStageModel.v1`; it does not parse binary RVM records or reuse old viewer state.
