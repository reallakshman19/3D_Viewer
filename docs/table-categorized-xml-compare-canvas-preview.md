# Table to Categorized XML — Compare Canvas Preview

Phase 11.3 adds an explicit preview panel inside Table to Categorized XML for semantic graph compare canvas data.

## Scope

This is preview-only. It does not modify the existing XML Compare workspace canvas, connector lane, PSNM, PS Mapping production workflow, SourceXML/TargetXML handoff, candidate matrix, or production remarks.

## User flow

1. Build the current categorized graph.
2. Click **Use Current Graph as Source Canvas**.
3. Import a target `categorizedGraph.json`.
4. Click **Use Imported Graph as Target Canvas**.
5. Click **Run Graph Compare**.
6. Click **Build Graph Connectors**.
7. Review counts and first connector rows.
8. Download `categorizedGraphConnectors.json`.

All steps are explicit. Nothing is pushed into the XML Compare workspace automatically.

## Reused clean modules

The preview panel uses the existing clean adapters:

- `createCategorizedGraphCanvasModel()`
- `comparePsMappingCategorizedGraphs()`
- `buildCategorizedGraphConnectors()`

It does not duplicate their identity, compare, or connector-building logic.

## Preview counts

The panel shows:

- Source records
- Target records
- Mapped connectors
- Mismatch connectors
- Missing markers
- Extra markers
- Diagnostics

## Connector table

The compact table combines the first rows from:

```js
[
  ...graphConnectors.matchMap.matches,
  ...graphConnectors.connectorCandidates.candidates
]
```

Columns shown:

- Type
- Match Type
- Compare Level
- Source Key
- Target Key
- Severity
- Finding
