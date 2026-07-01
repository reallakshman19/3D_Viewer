# 3D Json Viewer Phase 3.11 — RVM Diagnostics Scanner Evidence Hardening

## Candidate-only evidence

The diagnostics scanner remains a byte-level evidence collector, not a parser. Every record observation is explicitly candidate-only. The report carries `evidence.candidateOnly: true`, and each `byteRanges[]` item has `confirmed: false` plus confidence and reason codes.

## Why confirmed records remain zero

The scanner does not validate the full RVM binary grammar, record envelope lengths, transform payloads, material tables, hierarchy ownership, or geometry payloads. Therefore `evidence.confirmedRecords` stays `0`. A detected `CNTB`, `CNTE`, `PRIM`, or `BBOX` signature is useful evidence, but it is not a confirmed decoded RVM record.

## This is not parser completion

Harder evidence does not mean parser completion. The worker still returns `STAGE_RVM_PARSING_NOT_IMPLEMENTED` for valid binary preflight jobs because no `RvmStageModel.v1` is produced and no visual geometry is decoded.

## Unmatched CNTB/CNTE evidence

The scanner tracks a conservative candidate depth counter. Candidate `CNTB` increments depth. Candidate `CNTE` decrements depth when possible. Remaining open depth increments `unmatchedCntb`; a `CNTE` without an open candidate block increments `unmatchedCnte`.

## Suspicious native-code evidence

For candidate `PRIM` signatures, the scanner reads only a bounded little-endian numeric field. If the read is unavailable, `unknownNativeCodes` is incremented. If the value is outside the conservative native-code range, `suspiciousNativeCodes` and `unknownNativeCodes` are incremented. The scanner does not guess a primitive type from unsafe bytes.

## Bbox evidence

Candidate `BBOX` observations are counted as valid only when six bounded float values are finite and ordered as min/max. Invalid float data or inverted min/max increments `invalidBboxRecords` and `malformedCandidateRecords`.

## Scan limits and truncation

The scanner has a maximum byte scan limit. If the binary exceeds the safety limit, `scanLimitReached` and `truncatedCandidateRecords` are incremented, and a truncation warning is added. This keeps scanning deterministic and bounded for large benchmark files.

## Worker behavior

The worker now includes both `rvmDiagnosticsReport` and `rvmDiagnosticsSummary` in the `STAGE_RVM_PARSING_NOT_IMPLEMENTED` error context. It does not emit stage/package-ready messages for binary jobs.

## No model, render plan, or geometry chunks

The binary diagnostics path produces no `stageModel`, no `renderPlan`, no `manifest`, and no geometry chunks. The scanner does not mutate UI or canvas state and does not create any display geometry.

## Old viewer isolation

Old 3D RVM Viewer parser, bridge, renderer, hotfix, cache, IndexedDB, UI, and Three.js modules remain forbidden. The scanner is isolated under the staged parser/worker boundary so future GAS/RMSS benchmark gates can build on the evidence without inheriting old viewer behavior.
