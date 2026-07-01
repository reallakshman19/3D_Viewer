# 3D Json Viewer Phase 3.8 Geometry Chunk Contract

This phase freezes the metadata contract for `geometryChunks[]` before any code-11 facet decoding, mesh extraction, or binary geometry storage starts.

## Why this contract is required before code-11 decoding

RVM facet and mesh decoding will eventually produce geometry that can be large, chunked, cached, and owned by multiple primitives or components. The staged model needs a stable metadata shape before parser agents write chunked output, otherwise renderers could invent incompatible buffer layouts or treat incomplete metadata as real mesh geometry.

## Metadata-only vs future binary-backed chunks

This PR is metadata-only. It defines IDs, ownership, buffer-view descriptions, attributes, source byte ranges, material ranges, bbox ranges, diagnostics, and validation rules. It does not store raw vertex arrays and does not create binary buffers.

`inline-metadata-only` is allowed for tests, diagnostics, and contract samples. Future encodings such as `external-buffer`, `worker-cache-ref`, and `future-binary-pack` can point to real binary-backed payloads while keeping the same staged-model boundary.

## Buffer views and attributes

A chunk lists `buffers[]` as metadata views with role, byte offset, byte length, stride, component type, and count. `attributes` then refer to those views using stable names such as `position`, `normal`, `index`, `color`, and `material`.

Renderable mesh and facet-group chunks require a `position` attribute. Indexed mesh chunks require an `index` attribute. Buffer ranges must not exceed `source.byteLength` when the source byte length is known.

## Material ranges and bbox ranges

`materialRanges[]` identify spans with `start`, `count`, and `materialId`. `bboxRanges[]` identify spans with local/world bounds. `bboxLocal` and `bboxWorld` must be valid finite bbox6 arrays when present.

## Ownership links

Chunks link back to staged graph objects through:

- `ownership.nodeIds[]`
- `ownership.componentIds[]`
- `ownership.primitiveIds[]`

Stage validation checks these IDs against existing hierarchy nodes, components, and primitives. Primitive-level `geometryChunk` references are also checked against `model.geometryChunks[]` unless the primitive embeds a valid chunk metadata object directly.

## Why raw vertex buffers are not added now

Raw buffers belong to a future parser/cache/storage phase. This PR avoids large arrays and binary storage so the contract can be reviewed independently of code-11 decoding, worker caches, renderer upload behavior, and memory policy.

## Future code-11 parser requirements

Future parser agents must populate chunk metadata with source offsets, source lengths, buffer views, attributes, material ranges, bboxes, diagnostics, and ownership links. They must not mark code-11/facet output as renderable unless the chunk validates.

## Renderer requirements

Renderer agents must not render `MESH_CHUNK` or chunk-backed `FACET_GROUP` output without validated chunk metadata. Missing or invalid chunk metadata must remain diagnostic/proxy/fallback, not native/full mesh output.

## Old RVM Viewer stack remains forbidden

This contract does not import old 3D RVM Viewer parser, renderer, bridge, or hotfix modules. It also does not import UI, worker runtime, Three.js, IndexedDB, cache modules, or app routing.
