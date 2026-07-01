# Table to Categorized XML — Graph Connector Builder

Phase 11.2 adds a pure semantic connector builder for categorized graph compare results.

## Scope

The builder converts:

```text
Categorized graph compare result
+ Source graph canvas model
+ Target graph canvas model
→ Semantic connector model
```

It does not modify the XML Compare canvas, connector lane, PSNM, PS Mapping v20, SourceXML/TargetXML handoff, candidate matrix, manual connector behavior, or production remarks.

## Entry point

```js
buildCategorizedGraphConnectors({
  sourceCanvasModel,
  targetCanvasModel,
  graphCompareResult
});
```

## Output

```js
{
  schema: 'table-categorized-xml-graph-connectors/v1',
  matchMap: {
    schema: 'table-categorized-xml-graph-match-map/v1',
    request: {
      scope: 'categorized-graph',
      sourceSide: 'source',
      targetSide: 'target'
    },
    matches: []
  },
  connectorCandidates: {
    schema: 'table-categorized-xml-graph-connector-candidates/v1',
    summary: {
      enabled: true,
      candidateCount: 0,
      missingCount: 0,
      extraCount: 0,
      mismatchCount: 0
    },
    candidates: []
  },
  diagnostics: []
}
```

## Connector behavior

Mapped graph compare results become line-capable `matchMap.matches[]` connectors with `type: 'EXACT'` and `matchType: 'MATCHED'`.

Mismatch graph compare results become line-capable `matchMap.matches[]` connectors with `type: 'CANDIDATE'` and `matchType: 'MISMATCH'`.

Missing graph compare results become source-only semantic markers in `connectorCandidates.candidates[]` with `type: 'MISSING'` and `matchType: 'MISSING_IN_TARGET'`.

Extra graph compare results become target-only semantic markers in `connectorCandidates.candidates[]` with `type: 'EXTRA'` and `matchType: 'EXTRA_IN_TARGET'`.

## Gap mismatch level

Gap mismatches stay faithful to the graph compare result and remain `compareLevel: 'Gap'` with keys such as `PS-XYZ.1_GUIDE_Gap`. The connector builder does not promote gap mismatches to `SupportFeature` level.

## Identity rule

The builder uses exact semantic graph keys only. It does not fuzzy match, merge coordinate clusters, or drop suffixes.

Examples:

```text
PS-XYZ.1  != PS-XYZ.10
PS-XYZ__C001 != PS-XYZ__C002
```
