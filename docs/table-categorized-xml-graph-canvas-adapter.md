# Table to Categorized XML — Graph Canvas Adapter

Phase 11.1 adds a pure adapter from the canonical categorized graph to XML Compare canvas-ready records.

## Scope

The adapter is intentionally narrow:

- input: `CategorizedGraphExport.v1`
- output: `table-categorized-xml-graph-canvas-model/v1`
- semantic levels: `SupportFamily`, `SupportOccurrence`, `SupportFeature`, `Gap`
- default view: `SupportFeature`

It does not mutate SourceXML or TargetXML canvases. It does not change PS Mapping, PSNM, connector lanes, manual connector behavior, candidate matrices, or production remarks.

## Adapter entry point

```js
createCategorizedGraphCanvasModel({
  graph,
  side: 'source',
  title: 'Source Graph',
  profileId: 'ps-mapping-table-2-shadow-profile'
});
```

## Canvas compatibility

The adapter returns:

```js
{
  schema: 'table-categorized-xml-graph-canvas-model/v1',
  side: 'source',
  title: 'Source Graph',
  profileId: '...',
  records: [],
  levelViews: {},
  levelView: {},
  diagnostics: [],
  hierarchy: {}
}
```

Each record has a stable side-specific `uid`, `displayName`, and `key` so the existing XML Compare canvas can display records and future connector logic can refer to graph-level identities.

## UID convention

Examples:

```text
graph:source:SupportFamily:PS-XYZ__C001
graph:source:SupportOccurrence:PS-XYZ.1
graph:source:SupportFeature:PS-XYZ.1_GUIDE
graph:source:Gap:PS-XYZ.1_GUIDE_Gap
```

The `target` side uses the same graph key with `graph:target:...`.

## Hierarchy

The adapter also builds a lightweight graph hierarchy for future navigation:

```js
{
  rootKeys: [],
  familyToOccurrences: {},
  occurrenceToFeatures: {},
  featureToGaps: {}
}
```

This is semantic graph hierarchy, not line/node XML hierarchy.
