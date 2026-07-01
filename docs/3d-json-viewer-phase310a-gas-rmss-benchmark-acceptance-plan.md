# 3D Json Viewer Phase 3.10A GAS/RMSS Benchmark Acceptance Plan

This plan defines acceptance gates for future GAS and RMSS RVM benchmark work. It is planning and guardrail material only. It is diagnostics-only and does not implement parsing, binary scanning, stage model generation, render plan generation, or geometry chunks.

## Why acceptance starts with diagnostics, not visuals

Visual output can look plausible even when the binary record interpretation is wrong. GAS and RMSS benchmarks must therefore start with diagnostic evidence: source identity, binary preflight, record counts, hierarchy candidates, primitive/native-code counts, bbox validity, unknown records, and fallback reasons. Only after those diagnostics are stable can any future parser PR claim stage-ready or package-ready behavior.

## GAS/RMSS checks must not depend on semantic names

Benchmark acceptance must not infer geometry from names, paths, tags, support labels, valve labels, line names, or hierarchy text. Semantic names can help later identification, but they are not geometry evidence. A support, valve, flange, foundation, elbow, or mesh must not become visible geometry from a name/path alone.

## Code 4 and code 11 must be counted before rendered

RVM native code 4 elbow candidates and native code 11 facet/mesh candidates must be counted in diagnostics before any rendering claim. Counting candidates is not decoding. A candidate count only proves that records resembling those native codes were found. It does not prove native parameters, transforms, bboxes, topology, or visual readiness.

## Hierarchy recovery before UI claims

CNTB and CNTE hierarchy diagnostics must be measured before UI claims about recovered model structure. The diagnostics should report candidate counts, nesting/depth evidence, unmatched starts/ends, invalid ranges, and relationship confidence. UI text must not claim that a benchmark loaded as a valid staged hierarchy until the parser stage has proven it.

## No semantic-only visible geometry

Semantic-only geometry is not renderable native geometry. It must remain diagnostic fallback or hidden. No benchmark acceptance should approve visible geometry created from semantic text when binary-native parameters, verified bbox data, or validated geometry chunk metadata are absent.

## Forbidden fake geometry claims

The following claims are rejected:

- fake supports created from support names only
- fake valve blocks created from valve names only
- fake flange or foundation blocks created from path text only
- bbox-only native claims
- semantic-only visible geometry
- code 4 rendered without native parameters
- code 11 rendered without validated geometry chunk metadata
- visual output claimed before diagnostics establish record and hierarchy evidence

## Legacy viewer leakage remains forbidden

The staged parser path must stay independent from the old RVM Viewer parser, bridge, renderer, and hotfix stack. Future parser PRs must provide diagnostics and contract-compliant staged output through the new staged path only.

## Benchmark acceptance categories

### 1. File identity

The diagnostics report must record file name, file size, stable file hash, byte length, and benchmark label. The identity must be present before any record or visual claim.

### 2. Binary preflight

A binary preflight report must exist. It should report file identity, byte length, extension warning status, size consistency, and header/sniff warnings. Preflight success does not mean staged parsing is complete.

### 3. Record-count diagnostics

The diagnostics report must include total candidate record counts and a breakdown of recognized, unknown, undecoded, and invalid candidate records.

### 4. CNTB/CNTE hierarchy diagnostics

CNTB and CNTE candidate counts must be reported. The report should include hierarchy depth evidence, unmatched candidate records, and malformed range diagnostics.

### 5. PRIM/native-code diagnostics

PRIM candidates must be counted. Native code counts must be present by code number, including unknown code counts.

### 6. Code 4 elbow candidate count

Code 4 candidates must be counted separately. A code 4 count is not a render claim. Rendering is blocked until native parameters and transforms are decoded and validated.

### 7. Code 11 facet/mesh candidate count

Code 11 candidates must be counted separately. Rendering is blocked until validated geometry chunk metadata exists. A code 11 count alone must not create mesh output.

### 8. Bbox validity diagnostics

The diagnostics report must include valid bbox count, invalid bbox count, missing bbox count, and non-finite bbox count where applicable.

### 9. Unknown/undecoded record diagnostics

Unknown and undecoded candidate records must be reported with reason codes. They must not be silently converted to visible native geometry.

### 10. Fallback diagnostics

Fallback diagnostics must state why the object is fallback-only: unknown record, unsupported native code, invalid transform, invalid bbox, missing chunk metadata, or diagnostics-only phase.

### 11. No stage-ready/package-ready until parser stage is valid

Diagnostics-only phases must not emit stage-ready or package-ready acceptance. They must not produce a stage model, render plan, or geometry chunks.

### 12. No fake native geometry claims

Native geometry claims require decoded native parameters, valid transforms, valid bboxes, and the appropriate geometry provenance. Bbox proxy and semantic proxy output must never be labeled native.

### 13. No old viewer stack leakage

Future parser PRs must prove that the new staged path does not import or depend on legacy viewer parser, bridge, renderer, or hotfix modules.

## What future parser PRs must prove before visual RVM claims

Before any future PR claims visual RVM support for GAS/RMSS benchmarks, it must provide:

1. file identity diagnostics
2. binary preflight diagnostics
3. CNTB/CNTE hierarchy candidate diagnostics
4. PRIM and native-code count diagnostics
5. code 4 and code 11 candidate counts
6. bbox validity diagnostics
7. unknown/undecoded record diagnostics
8. fallback diagnostics for unsupported records
9. proof that no stage model/render plan/geometry chunks are generated in diagnostics-only mode
10. proof that no semantic-only visible geometry or bbox-only native claim is emitted
11. proof that no legacy viewer stack module is imported
