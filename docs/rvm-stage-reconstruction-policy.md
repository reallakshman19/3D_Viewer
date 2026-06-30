# RVM stage reconstruction policy

This policy governs how native RVM data becomes `RvmStageModel.v1` records.

## Prime rule

Native geometry decides shape. Semantic type decides grouping, label, icon, search, fallback policy, and Visual Quality recipes.

Never render shape from semantic name alone.

## Reconstruction priority

Use this priority order for every component:

1. Native decoded facet/mesh geometry.
2. Native decoded primitive geometry.
3. Native primitive composite assembly.
4. Reliable procedural reconstruction from native axis/bbox/radius/transform.
5. Catalogue/template proxy only when metadata proves the type.
6. Diagnostic fallback only.

A lower-priority path must not override a higher-priority path.

## Component rules

### Pipe

- Native cylinder records become `CYLINDER` primitives.
- Axis, radius, bbox, transform, material, owner path, and record offset must be preserved.
- Skeleton mode uses centerline.

### Elbow / bend

- RVM code 4 / `CircularTorus` is the primary elbow/bend source.
- Stage record must preserve native `offset`, `radius`, `angle`, transform matrix, and bbox.
- Bbox-only elbow reconstruction is diagnostic or derived, not native.

### Tee

- Native tee/fitting primitive groups have priority.
- If only reliable axis/bbox/radius data exists, build a `TEE` component as main run + branch + hub with `geometry=derived` confidence.
- If branch direction cannot be proven, use diagnostic fallback.

### Flange

- Native primitive assembly has priority.
- Derived flange is allowed only when axis, thickness, OD, bore/radius, and location can be determined.
- Bolt hints are optional and must not imply exact catalogue accuracy unless metadata proves bolt count/circle.

### Valve

- Native valve assembly has priority.
- Semantic valve proxy is allowed only as a lower-quality recipe or diagnostic proxy when native geometry is insufficient.
- Valve type/rating/facing must be treated as unknown unless ATT/XML/RVM/catalogue metadata proves it.

### Support

- `/PS-*` and support names are ownership/identity clues only.
- Geometry must come from native primitives/facets/boxes/cylinders/structural profiles.
- Never create a generic giant `SUPPORT_STAND` from support semantics.
- Undecoded support geometry gets bbox/wire/small-X diagnostics.

### Foundation / civil

- Native boxes/facets/meshes have priority.
- These can be merged by material in Medium/Light recipes for performance.
- Hidden reinforcement or construction details must not be invented.

### T-post / structural member

- Native boxes/facets/profile geometry has priority.
- Profile extrusion is allowed only if section/profile dimensions are reliable.
- Otherwise use native boxes/facets, or bbox/wire diagnostic fallback.

## Confidence requirements

Every component must declare:

```json
{
  "confidence": {
    "geometry": "native | derived | semantic-proxy | diagnostic",
    "semantic": "attribute | name-rule | geometry-rule | unknown"
  }
}
```

## Fallback requirements

Every fallback must create a diagnostic message with:

- severity
- stable ID reference
- native code/offset where available
- fallback reason
- chosen render recipe

Silent fallback is not allowed.

## Visual Quality policy

Visual Quality selects a predeclared render recipe from stage data.

- `Full`: native or highest-confidence derived geometry.
- `Medium`: reduced segments, merged static meshes, simplified assemblies.
- `Light`: proxy/wire/bbox with object identity preserved.
- `Skeleton`: centerline/symbolic/bbox outline.
- `Hidden`: actual hidden state.

Visual Quality must not mean “show random 50 percent of objects”.

## Static-browser processing policy

The browser worker may spend minutes on conversion if progress is visible and cancellation is available.

The UI thread must remain responsive. The worker must not touch the DOM. Large outputs should be cacheable by file hash, schema version, and converter version.
