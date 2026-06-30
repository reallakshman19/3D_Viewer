# 3D Json Viewer Render Recipe Contract

The render recipe contract defines how `RvmStageModel.v1` primitives and components map to renderer intent for each Visual Quality level. It does not render geometry, import Three.js, parse RVM, or create UI behavior.

## Why render recipes exist

Phase 2 renderer agents need deterministic contract data before they create renderer code. Without recipes, each renderer path could invent its own interpretation of `renderKind`, `semanticType`, confidence, and Visual Quality. Recipes make those decisions explicit and testable before rendering starts.

A recipe is metadata. It says what kind of output a renderer is allowed to produce, such as procedural geometry, mesh chunk, proxy, bbox, symbol, or hidden. It does not contain Three.js objects or raw RVM records.

## Visual Quality mapping

Visual Quality selects a declared recipe. It must not mutate random scene objects or hide a percentage of objects after rendering.

Component-level default mapping:

| Visual Quality | Component recipe |
|---|---|
| `full` | `component-native-assembly` |
| `medium` | `component-simplified-assembly` |
| `light` | `component-proxy-bbox` |
| `skeleton` | `component-centerline-symbol` |
| `hidden` | `component-hidden` |

Diagnostic components use `component-diagnostic-only` for visible qualities and `component-hidden` for hidden quality.

Primitive-level hidden quality always selects `primitive-hidden`. Unknown or undecoded fallback primitives select `primitive-unknown-diagnostic-bbox` for visible qualities.

## Primitive recipe vs component recipe

Primitive recipes describe how a single stage primitive may be rendered. Examples:

- `CYLINDER` -> `primitive-cylinder-native`
- `ELBOW` -> `primitive-code4-elbow-native`
- `FACET_GROUP` -> `primitive-facet-group-native`
- `UNKNOWN_DIAGNOSTIC` -> `primitive-unknown-diagnostic-bbox`

Component recipes describe how a component assembly is presented at a quality level. A component recipe may use its child primitive recipes, simplify an assembly, show a proxy bbox, show a symbol, or hide it.

Keeping these separate prevents component names from replacing primitive geometry. A valve, tee, flange, or support component can decide grouping and quality policy, but its shape must still come from stage primitives or explicit diagnostic fallback.

## Semantic names are not geometry

Recipe selection must not use semantic names as geometry. Names such as `/PS-*`, `SUPPORT`, `TEE`, `FLANGE`, or `VALVE` may help identify a component, label it, group it, or choose a fallback policy. They must not create visible native geometry by themselves.

A primitive with `confidence.geometry = "semantic-proxy"` must not select a visible native geometry recipe. It must remain diagnostic or fail validation until the stage data carries native or derived geometry.

## Diagnostic fallback representation

Unknown, undecoded, and fallback primitives remain explicit through:

- `renderKind: "UNKNOWN_DIAGNOSTIC"`
- diagnostic confidence where appropriate
- fallback diagnostics in the stage model
- `primitive-unknown-diagnostic-bbox` recipe
- `component-diagnostic-only` recipe for diagnostic components

The renderer must surface these as diagnostic output and must not silently upgrade them into pipes, supports, valves, tees, or flanges.

## What Phase 2 renderer is allowed to do

Phase 2 renderer agents may:

- consume `RvmStageModel.v1`
- call recipe-selection helpers
- render from selected recipe metadata
- use primitive IDs, component IDs, and node IDs for selection
- show diagnostics from the stage model
- choose deterministic renderer implementations for recipe outputs

## What Phase 2 renderer is forbidden to do

Phase 2 renderer agents must not:

- inspect raw RVM records
- import existing RVM Viewer bridge/hotfix modules
- infer geometry from semantic names alone
- mutate arbitrary Three.js objects as Visual Quality behavior
- hide a random percentage of objects for quality levels
- silently render unknown or undecoded records as native geometry
- parse RVM bytes in the UI
- create alternative schemas outside `RvmStageModel.v1`

## Contract boundary

`StageRenderRecipes.js` is a contract module only. It must remain DOM-free, Three.js-free, worker-free, parser-free, cache-free, and app-shell-free. It returns recipe objects and validation results only.
