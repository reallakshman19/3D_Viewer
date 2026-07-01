# 3D Json Viewer RVM Parser Acceptance Vocabulary

This vocabulary defines strict terms for future RVM parser acceptance. It supports diagnostics-only benchmark work and prevents visual or native-geometry claims before evidence exists.

## Preflight

Meaning: A shallow source-integrity check for file identity, size, hash, byte length, extension warnings, and header/sniff warnings.

Does not mean: The RVM parser is complete, records are decoded, or visual rendering is implemented.

Evidence required: File name, file size, file hash, byte length, preflight status, errors, and warnings.

## Candidate record

Meaning: A byte-range or scanner observation that appears to match a record pattern such as CNTB, CNTE, or PRIM.

Does not mean: The record is confirmed, decoded, or safe to render.

Evidence required: Source offset/range, candidate type, confidence, and diagnostics explaining why it is only a candidate.

## Confirmed record

Meaning: A record whose boundary, type, length, and minimum structural rules have been validated by the staged parser.

Does not mean: All native geometry is decoded or visually ready.

Evidence required: Valid record boundary, type, byte length, source offset, and parser diagnostics proving the record passed structural checks.

## Decoded native primitive

Meaning: A PRIM/native record whose native parameters, transform, bbox, code, and provenance have been decoded into staged contract fields.

Does not mean: A semantic label, bbox proxy, or candidate code count.

Evidence required: Native record reference, native code, decoded native params, valid transform, valid bboxLocal/bboxWorld, and non-fallback recipe provenance.

## Undecoded record

Meaning: A candidate or confirmed record that has not been converted into contract-valid native parameters.

Does not mean: It can be rendered as native geometry.

Evidence required: Record identity, reason for non-decoding, fallback diagnostic, and no native/full geometry claim.

## Native code count

Meaning: A diagnostic summary of native code occurrences observed in PRIM candidates or confirmed records.

Does not mean: Those native codes have been decoded or rendered.

Evidence required: Code number, count, source scope, unknown-code count, and undecoded-code count.

## Diagnostic fallback

Meaning: A structured explanation that native geometry is unavailable and the object must remain fallback, proxy, hidden, or diagnostic-only.

Does not mean: Native geometry or visual correctness.

Evidence required: Fallback reason, severity, affected record/primitive/component, and explicit diagnostic/fallback recipe semantics.

## Semantic proxy

Meaning: An inferred representation from names, paths, hierarchy, tags, or other semantic metadata.

Does not mean: Binary-native geometry, decoded primitive data, or visible real geometry.

Evidence required: Semantic source, confidence level, fallback semantics, and proof that it is not used as native visible geometry.

## Bbox proxy

Meaning: A bounding-box representation used for coarse preview, fallback, or diagnostics.

Does not mean: Native geometry, decoded mesh, decoded elbow, support geometry, or valve geometry.

Evidence required: Valid finite bbox, fallback/proxy recipe source, and no native geometry claim.

## Native geometry

Meaning: Geometry backed by decoded native parameters and source-record provenance.

Does not mean: Bbox proxy, semantic proxy, diagnostic fallback, or code count.

Evidence required: Native record reference, native params, valid transform, valid bboxes, geometry confidence, and accepted native recipe source.

## Geometry chunk

Meaning: Metadata describing future mesh/facet/point/line geometry buffers, attributes, material ranges, bboxes, diagnostics, and ownership links.

Does not mean: Raw vertex arrays are embedded or code 11 rendering is complete.

Evidence required: Valid StageGeometryChunk metadata, ownership references, required position/index attributes where applicable, bboxes, and diagnostics.

## Component assembly

Meaning: A staged grouping that describes how primitives/components may be assembled for component-level output.

Does not mean: A free pass to create fake supports, valves, foundations, or flanges from names.

Evidence required: Component/primitive references, assembly provenance, render policy, and geometry evidence for every visible native part.

## Stage-ready

Meaning: The worker/parser has produced a valid staged model that passes contract validation and acceptance gates.

Does not mean: Diagnostics-only scanning succeeded.

Evidence required: Valid RvmStageModel, diagnostics, source identity, acceptance report, and no unresolved parser-stage blocking errors.

## Package-ready

Meaning: A validated staged package manifest and required staged artifacts are ready for downstream use.

Does not mean: The raw RVM binary was scanned or preflighted only.

Evidence required: Valid package manifest, source hash consistency, required artifact metadata, diagnostics, and acceptance report.

## Visual support claim

Meaning: A statement that a support-like object is visible as real geometry in the staged viewer.

Does not mean: A support name, support path, semantic tag, bbox proxy, or fallback diagnostic.

Evidence required: Decoded native geometry or validated geometry chunk metadata tied to the support primitive/component. Semantic-only support claims must be rejected.
