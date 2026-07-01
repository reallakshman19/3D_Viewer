# 3D Json Viewer Phase 4.2B — Code 4 Elbow Render Readiness

## Scope

This phase prepares staged-model and render-side readiness for RVM native code 4 elbows. It is not binary decoding and it does not claim that real code 4 records are decoded from `.rvm` files.

The new sample is a staged fixture only. It is not GAS/RMSS evidence and is not AVEVA Review/Navis parity evidence.

## Why code 4 still needs parser integration later

A real code 4 RVM primitive must be read by the parser or record-reader path before it can be trusted. That later work must prove record boundaries, payload layout, transforms, native parameters, and bounding boxes. This phase only defines what the staged output must look like after that evidence exists.

## Required staged fields for supported ELBOW rendering

The render plan now treats an `ELBOW` primitive as supported only when the staged primitive has native evidence for code 4:

- `renderKind: "ELBOW"`
- native primitive metadata with `code: 4` and `decoded: true`
- `nativeRecord.recordType: "RVM_PRIMITIVE"`
- `nativeRecord.nativeCode: 4`
- `nativeRecord.decoded: true`
- `nativeGeometry.provenance: "native"`
- complete elbow native params such as tube radius, bend radius, and angle
- native transform and bounds: `transform3x4`, `bboxLocal`, and `bboxWorld`
- `confidence.geometry: "native"`

## Why incomplete native params remain diagnostic

A bbox or native-code number alone is not enough to render a meaningful elbow. Missing bend radius, tube radius, angle, transform, or bbox evidence can produce misleading geometry. Incomplete staged params therefore classify as diagnostic-only with a bbox fallback reason instead of supported procedural rendering.

## No code 11, facet, or support claims

This phase does not add code 11 mesh/facet decoding, support assembly rendering, flange/valve rendering, or component assembly rendering. Those remain separate contracts and parser/decoder phases.

## Old viewer isolation

No old 3D RVM Viewer parser, bridge, renderer, hotfix, UI, worker, cache, or IndexedDB modules are used. The implementation stays inside staged render/sample/test files and does not decode binary data.
