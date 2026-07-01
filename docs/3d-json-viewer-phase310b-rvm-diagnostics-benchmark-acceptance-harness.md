# 3D Json Viewer Phase 3.10B RVM Diagnostics Benchmark Acceptance Harness

This phase adds a deterministic acceptance harness for diagnostics-only RVM benchmark reports. It does not implement parsing, binary scanning, worker behavior, stage model generation, render plans, or geometry chunks.

## Diagnostics acceptance is not parser acceptance

A diagnostics report can show useful evidence without proving parser completion. The harness accepts only the diagnostic evidence required for benchmark-gate review. A valid harness result always remains diagnostics-only, parser-incomplete, and not visually ready.

## GAS/RMSS checks must be deterministic

GAS and RMSS benchmark review must be repeatable. The harness evaluates explicit input fields: source identity, preflight, diagnostics report, native-code counts, hierarchy depth, and minimum candidate counts. It does not inspect a binary file or infer geometry from names.

## Minimum candidate counts are acceptance inputs

Minimum CNTB, CNTE, PRIM, code 4, code 11, and native primitive record counts are benchmark-case inputs. They are not hard-coded parser truth. A future fixture runner can set minimums per benchmark revision while the harness remains stable.

## Diagnostics-only output must not contain staged artifacts

The harness rejects reports containing stage model, render plan, manifest, or geometry chunk fields. Those outputs belong to later parser/package phases. In diagnostics-only mode, the acceptance result must not be used as stage-ready or package-ready proof.

## Visual-ready and parser-complete claims are rejected

The harness rejects any report that claims visual-ready or parser-complete status. It also rejects semantic-only visible geometry evidence. Candidate counts and warnings can support future work, but they are not visual rendering claims.

## Future GAS/RMSS fixture integration

Future fixture runs should generate diagnostics reports and pass them to `evaluateRvmDiagnosticsBenchmark(report, benchmarkCase)`. Each benchmark case should provide file identity and expected minimum counts for the current fixture version. The result can be used as a benchmark-gate review artifact without enabling rendering or parser-complete claims.

## Old RVM Viewer imports remain forbidden

The harness is independent from old RVM Viewer parser, bridge, renderer, and hotfix modules. It imports no parser, worker, contract, sample, renderer, UI, browser 3D library, browser cache, or legacy viewer modules.
