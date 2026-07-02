# RVM wide-record reader vertical slice

## Purpose

This phase adds the first real binary foundation for the 3D Json Viewer RVM path:

```text
Real RVM binary
→ wide-tag record reader
→ CNTB/CNTE hierarchy stack
→ PRIM native record slices
→ RvmNativeRecordLedger.v1
```

The output is a traceable native record ledger only. It is not a render model and it is not a `RvmStageModel.v1` emission path.

## Wide tags, not plain ASCII tags

AVEVA Review RVM binary records use wide four-character tags. Each tag character is stored as a big-endian `uint32`, for example:

```text
HEAD = 00 00 00 48 00 00 00 45 00 00 00 41 00 00 00 44
PRIM = 00 00 00 50 00 00 00 52 00 00 00 49 00 00 00 4D
```

The stage-side wide reader walks records through the big-endian `nextOffset` field instead of scanning for plain ASCII `CNTB` or `PRIM` byte sequences.

## Geometry source policy

RVM binary is the primary geometry source for this phase. The reader works with RVM alone.

ATT is intentionally unused. ATT may become optional semantic enrichment in a later phase, but it is not required to read native RVM record structure and must not be treated as the source of geometry in this vertical slice.

## Ledger scope

`RvmNativeRecordLedger.v1` records native evidence:

- source file identity and byte length
- reader schema/version
- CNTB hierarchy nodes and parent paths
- PRIM byte ranges and native primitive codes
- parser diagnostics, warnings, and errors

The ledger does not decode primitive geometry. Every primitive record keeps:

```text
geometryDecoded: false
semanticSource: rvm-only
decodeStatus: record-read
```

## Explicit non-goals

This phase does not implement:

- StageModel rendering
- `RvmStageModel.v1` emission
- primitive geometry decoding
- ATT enrichment
- UI changes
- production 3D RVM Viewer replacement
- visual parity claims
- parser-complete claims

Both reader and ledger must keep:

```text
parserComplete: false
visualParityClaimed: false
```

## Benchmark runner

A local RVM file can be checked without committing the benchmark file:

```bash
node scripts/bench-rvm-wide-reader.mjs /path/to/ASIM-1835.rvm
```

To write the full report and ledger:

```bash
node scripts/bench-rvm-wide-reader.mjs /path/to/ASIM-1835.rvm --out /tmp/asim-1835-wide-reader.json
```

The runner prints record counts, primitive code counts, hierarchy balance, max depth, ledger node count, and ledger primitive count.
