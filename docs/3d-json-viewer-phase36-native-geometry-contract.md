# 3D Json Viewer Phase 3.6 Native Geometry Contract

This phase hardens `RvmStageModel.v1` before any real staged-path RVM parser or visual decoder starts. The goal is to prevent future agents from marking preview/proxy/fallback output as native/full geometry without verifiable native geometry provenance.

## Why this is needed before parser work

A parser can decode native RVM records only after it proves where the data came from, what record was decoded, what parameters were recovered, what transform/bounds apply, and whether the result is native, chunk-backed, proxy, or diagnostic. Without explicit provenance fields, a later worker or renderer could accidentally treat bbox previews or semantic-only placeholders as accurate native geometry.

## Geometry categories

### Native geometry

Native geometry means already-decoded native parameters tied to a native source record. A primitive that claims `recipeSource.source === "native"` must provide a valid `nativeRecord` and native parameter metadata. Native provenance is metadata only; it does not parse RVM by itself.

### Bbox proxy geometry

Bbox proxy geometry is a low-confidence preview or fallback shape. It may be useful for coarse navigation, but it is not native geometry and must not be labeled as native/full/procedural output.

### Semantic proxy geometry

Semantic proxy geometry comes from names, hierarchy, or inferred semantic type rather than decoded geometry. Semantic-only geometry must remain diagnostic/fallback only and cannot be visible as real geometry.

### Geometry chunks

`geometryChunk` is a metadata reference to future chunked geometry data. It is not raw vertex storage in this phase. A `MESH_CHUNK` primitive that claims native/full/chunk output must provide valid `geometryChunk` metadata.

### Component assemblies

`componentAssembly` describes component-level grouping for assembled render output. Assembly references must point to known components/primitives where IDs are supplied.

### Diagnostic fallback

`diagnosticFallback` records why an object cannot be rendered as native geometry. Visible diagnostic fallbacks must use diagnostic/fallback semantics, not native render semantics.

## Why `MESH_CHUNK` requires geometry chunk metadata

A mesh-chunk primitive has no meaningful native/full output unless the staged model can identify the chunk that contains its geometry. Without `geometryChunk`, claiming native/full mesh output would be unverifiable and would allow fake mesh rendering claims.

## Why `FACET_GROUP` requires decoded facets or geometry chunk metadata

Facet groups may be native geometry only when the staged model has decoded facet metadata or a chunk reference. If neither is present, the model cannot prove that facet geometry exists and must not claim native/full output.

## Parser agent requirements

Future parser agents must populate:

- `nativeRecord` for source binary record identity
- `nativeParams` for already-decoded native parameters
- `transform3x4` or legacy `transform.matrix3x4` with exactly 12 finite numbers
- `bboxLocal` and `bboxWorld` with valid finite bounds
- `geometryChunk` when mesh/chunk output is claimed
- `diagnosticFallback` when native decoding is unavailable
- `recipeSource` that truthfully identifies native, component assembly, bbox proxy, semantic proxy, diagnostic fallback, or hidden output

Parser agents must not create native/full geometry claims from object names, support labels, hierarchy labels, bbox-only data, or old bridge fallback shapes.

## Renderer agent requirements

Renderer agents must not bypass these fields. If a primitive or component lacks native/chunk/assembly provenance, it must be treated as bbox/proxy/diagnostic/hidden according to its declared `recipeSource`, confidence, and fallback metadata.

## Old RVM Viewer stack remains forbidden

This contract does not import old 3D RVM Viewer parser, bridge, renderer, or hotfix modules. Native provenance belongs to the staged-model contract and must remain independent of legacy browser bridge behavior.
