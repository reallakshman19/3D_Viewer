# RvmStageModel.v1 contract

`RvmStageModel.v1` is the authoritative contract between RVM/staged conversion and the new 3D Json Viewer renderer.

It is not a UI state object and it is not a dump of Three.js objects. It is a stable render/review model.

## Top-level model

```json
{
  "schema": "RvmStageModel.v1",
  "generator": {
    "name": "3D_Viewer browser stage worker",
    "version": "0.1.0"
  },
  "source": {
    "fileName": "model.rvm",
    "fileSize": 0,
    "fileHash": "",
    "units": "m",
    "coordinateBasis": "rvm-native"
  },
  "hierarchy": {
    "rootId": "node-root",
    "nodes": []
  },
  "materials": [],
  "components": [],
  "primitives": [],
  "geometryChunks": [],
  "diagnostics": {}
}
```

## Identity model

Every visible or selectable item must trace back to stable stage IDs.

| ID | Meaning |
|---|---|
| `nodeId` | hierarchy node / owner group |
| `componentId` | grouped plant/component object |
| `primitiveId` | native primitive/facet/procedural render primitive |
| `materialId` | material/color record |
| `geometryChunkId` | binary geometry chunk reference |

Selection must use these IDs, not DOM text or label matching.

## Hierarchy node

```json
{
  "id": "node-000010",
  "parentId": "node-root",
  "name": "/PS-171036.10",
  "path": "/AREA/ZONE/PS-171036.10",
  "kind": "RVM_NATIVE_CONTAINER",
  "componentIds": [],
  "primitiveIds": [],
  "bboxWorld": [0, 0, 0, 1, 1, 1]
}
```

## Primitive record

```json
{
  "id": "prim-000001",
  "nodeId": "node-000010",
  "componentId": "comp-000020",
  "native": {
    "recordOffset": 123456,
    "code": 4,
    "kind": "CircularTorus",
    "decoded": true
  },
  "transform": {
    "matrix3x4": [],
    "bboxLocal": [],
    "bboxWorld": []
  },
  "params": {
    "offset": 0.25,
    "radius": 0.05,
    "angle": 1.57079632679
  },
  "renderKind": "ELBOW",
  "materialId": "mat-001",
  "diagnostics": []
}
```

## Component record

```json
{
  "id": "comp-000020",
  "nodeId": "node-000010",
  "semanticType": "SUPPORT",
  "name": "PS-171036.10",
  "ownerPath": "/AREA/ZONE/PS-171036.10",
  "primitiveIds": ["prim-000001"],
  "bboxWorld": [],
  "confidence": {
    "geometry": "native",
    "semantic": "attribute"
  },
  "renderPolicy": {
    "full": "native-assembly",
    "medium": "simplified-assembly",
    "light": "proxy",
    "skeleton": "centerline-symbol",
    "hidden": "hide"
  },
  "diagnostics": []
}
```

## Render kinds

Allowed initial render kinds:

- `CYLINDER`
- `BOX`
- `SPHERE`
- `ELBOW`
- `TEE`
- `FLANGE`
- `VALVE_ASSEMBLY`
- `SUPPORT_ASSEMBLY`
- `FOUNDATION`
- `STRUCTURAL_MEMBER`
- `FACET_GROUP`
- `MESH_CHUNK`
- `UNKNOWN_DIAGNOSTIC`

## Semantic types

Allowed initial component semantic types:

- `PIPE`
- `ELBOW`
- `TEE`
- `FLANGE`
- `VALVE`
- `SUPPORT`
- `FOUNDATION`
- `STRUCTURAL_MEMBER`
- `T_POST`
- `PLATE`
- `BRACKET`
- `UNKNOWN`

## Geometry confidence

| Value | Meaning |
|---|---|
| `native` | direct decoded RVM geometry/facet/primitive |
| `derived` | reliable procedural reconstruction from native dimensions |
| `semantic-proxy` | catalogue/template/proxy from semantic type |
| `diagnostic` | bbox/wire/small-X fallback only |

## Semantic confidence

| Value | Meaning |
|---|---|
| `attribute` | explicit ATT/RVM/XML attribute or native owner evidence |
| `name-rule` | inferred from stable name/path rule |
| `geometry-rule` | inferred from geometry pattern |
| `unknown` | no reliable semantic identity |

## Geometry chunks

Heavy mesh/facet data should not be stored as giant JSON arrays.

```json
{
  "id": "geom-000001",
  "uri": "geometry-0.bin",
  "encoding": "float32-uint32-interleaved-v1",
  "bboxWorld": [],
  "byteLength": 0
}
```

## Diagnostics contract

Diagnostics must be part of the staged model, not console-only text.

```json
{
  "schema": "RvmStageDiagnostics.v1",
  "severityCounts": {
    "info": 0,
    "warning": 0,
    "error": 0
  },
  "nativeCodeCounts": {},
  "renderKindCounts": {},
  "semanticTypeCounts": {},
  "fallbackCounts": {},
  "messages": []
}
```

Every fallback or undecoded native record must create a diagnostic message with a stable record/component/primitive reference.
