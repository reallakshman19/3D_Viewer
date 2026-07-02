# 3D Json Viewer Phase 4.4B — RVM Evidence Report Runner

## Scope

This phase adds a reusable evidence report runner for `.rvm` ArrayBuffer inputs. It runs preflight, diagnostics scanning, record-reader evidence, and the current MVP parser attempt, then returns one consolidated evidence report.

This is evidence reporting, not parser completion. The report always keeps:

- `claims.parserComplete: false`
- `claims.visualParityClaimed: false`
- `claims.realCompatibilityProven: false`

No UI, renderer, geometry chunks, old RVM Viewer path, or code 11 decoder is added.

## Manual use with real RMSS/GAS files later

Real project/customer `.rvm` binaries must stay outside the repository. A local/manual runner can read a real file as an ArrayBuffer, then call:

```js
import { runRvmEvidenceReport } from './viewer/stage/benchmark/RvmEvidenceReportRunner.js';

const report = runRvmEvidenceReport({
  jobId: 'manual-rmss-check-001',
  fileName: 'RMSS.rvm',
  fileHash: '<externally-computed-hash>',
  fileSize: arrayBuffer.byteLength,
  arrayBuffer,
});
```

The resulting JSON can be inspected locally or attached as a sanitized evidence artifact if it contains no customer/project-sensitive binary content.

## Why real RVM files are not committed

Real RMSS/GAS files may contain customer, project, catalogue, hierarchy, tag, and model IP. The repo should contain only source code and tiny synthetic fixtures. Real evidence should be generated locally from external files and reviewed as a report, not committed as binary data.

## Evidence to inspect for real code-4 layouts

For real code-4 investigation, inspect:

- `diagnostics.summary.nativeCodeCounts`
- `recordReader.summary.primPayloadSliceCount`
- `recordReader.report.primPayloadSlices`
- `parser.summary.decoderSummaries`
- `codeEvidence.code4.candidateCount`
- `codeEvidence.code4.decodeSuccess`
- `codeEvidence.code4.decodeFailure`

A real file with code-4 candidates but zero decode success likely has a different payload layout from the synthetic MVP layout.

## How decoder summaries reveal layout mismatch

The Phase 4.3A decoder reports layout support and reason codes for each attempted code-4 slice. Those summaries show whether the slice failed because of missing bounded evidence, short payload, invalid transform, invalid bbox, invalid radius/bend radius/angle, or another unsupported MVP-layout condition.

## Code 11 remains counted only

The runner may count code-11 candidates through diagnostics and record-reader native-code counts. It does not decode code 11, create mesh/facet output, or create geometry chunks. `codeEvidence.code11.decoded` remains false.

## Decision categories

- `preflight-failed`: input envelope or binary is invalid.
- `synthetic-mvp-success`: the current MVP parser produced staged output. This is not a real compatibility claim.
- `evidence-only`: scanner or record-reader evidence exists, but the parser did not produce a staged model.
- `runner-failed`: the runner caught an unexpected exception and returned a report instead of throwing.

## No compatibility/parity claim

Even when the synthetic code-4 MVP fixture succeeds, the report does not claim RMSS/GAS compatibility, Navis parity, Review parity, or full parser coverage. It is a structured evidence artifact for later real-file analysis.
