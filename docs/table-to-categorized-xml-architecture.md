# Universal Table to Categorized XML Builder Architecture

## Purpose

The Universal Table to Categorized XML Builder imports arbitrary tabular sources and resolves them into a typed recursive categorized graph. The builder starts in XML Compare as a shadow-mode utility named **Table to Categorized XML**.

## Core model rule

The canonical categorized graph is the master model. XML is only one export format. Candidate rows, preview rows, output rows, resolver rows, and exported XML fragments must never become the master model.

The internal engine must not assume a fixed `Root -> Parent -> Child -> GrandChild` depth. `Parent`, `Child`, and `GrandChild` are UI labels only. The actual structure is recursive `LevelDefinition[]` producing recursive `GraphNode[]` relationships.

## Document root and logical partitions

XML exports must have a single XML document root. Logical splits are represented as root partitions below that document root, not as multiple XML roots.

The document root is single. Logical root partitions can split by file, zone, column, token, regex, or coordinate cluster.

Root behavior is static by default. Profiles may declare dynamic logical root partitions, but the export must still validate `graph_has_single_document_root` before XML generation.

## Engine correctness rules

- `level.xmlTag || level.levelId` is authoritative for exported XML element names.
- XML export must keep one document root; logical partitions are nested elements below that root.
- Only implemented creation modes may execute: `static`, `zero-or-one`, `one-per-key`, and `one-per-row`.
- Unsupported creation modes such as `many-per-row`, `conditional`, `lookup-joined`, and `coordinate-clustered` are BLOCKER diagnostics until implemented.
- `one-per-row` without `keyResolver` uses stable row identity, based on `sourceId + rowId`, so rows do not collapse into one node.
- Duplicate headers are preserved with stable internal `columnIds`; duplicate headers must produce diagnostics and must not overwrite raw cell evidence.
- Delimiter mode supports `auto`, `tab`, `comma`, `pipe`, `semicolon`, and `whitespace`; auto-detect remains the default.

## Contract names

- `UniversalCategorizerProfile.v1`
- `ImportSource.v1`
- `ResolverPipeline.v1`
- `LevelDefinition.v1`
- `GraphNode.v1`
- `GraphEdge.v1`
- `CategorizerDiagnostic.v1`
- `CategorizedGraphExport.v1`

## ImportSource[]

`ImportSource[]` stores raw imported sources. It preserves source identity, raw headers, raw cells, raw row references, parse diagnostics, delimiter metadata, stable internal column IDs, and source-level metadata.

Minimum shape:

```js
{
  schema: 'ImportSource.v1',
  sourceId: 'S1',
  sourceName: 'Table 2 - Model PS Data',
  sourceType: 'pasteText',
  delimiterMode: 'auto',
  delimiter: 'tab',
  headers: ['PS NO', 'Bore', 'Support Gap'],
  columnIds: ['PS_NO', 'Bore', 'Support_Gap'],
  rows: [
    {
      rowId: 'S1:1',
      rawCells: ['PS-01', '4', '5'],
      rawByHeader: {
        'PS NO': 'PS-01',
        Bore: '4',
        'Support Gap': '5'
      },
      rawByColumnId: {
        PS_NO: 'PS-01',
        Bore: '4',
        Support_Gap: '5'
      }
    }
  ],
  diagnostics: []
}
```

Raw source rows are evidence. They are not graph nodes and are not the master model.

## ResolverPipeline[]

`ResolverPipeline[]` declares how raw source evidence becomes typed resolver outputs. Display name, group key, object key, lookup key, and field values are separate resolver concepts.

Resolvers must not write directly to XML. They emit typed outputs for graph construction and diagnostics.

## LevelDefinition[]

`LevelDefinition[]` is recursive. Each level declares a level id, optional XML tag, display label, key strategy, parent strategy, allowed child level definitions, and validation gates.

`Parent`, `Child`, and `GrandChild` labels may be shown in the UI, but the engine uses recursive `LevelDefinition[]` internally.

## GraphNode[]

`GraphNode[]` is the canonical categorized master model. Each node has a stable graph id, level id, parent id, display name, object key, group key, lookup keys, field values, source references, and diagnostics.

Graph nodes are not XML nodes. XML tag names and attributes are export-profile decisions.

## GraphEdge[]

`GraphEdge[]` declares typed relationships between graph nodes. Parent-child hierarchy is one edge type; future phases may add lookup, reference, evidence, or compare edges.

## Diagnostic[]

`Diagnostic[]` records parse, resolver, graph, validation, and export issues. Diagnostics must include severity, code, message, and stable source or graph references when available.

## ExportProfile[]

`ExportProfile[]` maps the canonical graph to output formats. XML export is one profile type only. Later JSON, table, compare, or canvas-handoff exports must still consume the graph, not candidate/output rows.

## Coordinate grouping contract for later phases

Coordinate grouping requires unit, axis mapping, rounding, tolerance, cluster method, origin/datum, coordinate source, and failure policy.

Coordinate grouping must fail validation unless `coordinate_units_declared` and `coordinate_tolerance_declared` pass.

## Validation gates

Required gate names:

- `source_parse_ok`
- `required_columns_present`
- `resolver_outputs_non_empty`
- `key_parts_non_empty`
- `key_uniqueness_per_parent`
- `display_name_resolved`
- `parent_link_resolved`
- `coordinate_units_declared`
- `coordinate_tolerance_declared`
- `multi_value_policy_declared`
- `duplicate_key_policy_declared`
- `xml_tag_valid`
- `xml_attribute_valid`
- `graph_has_single_document_root`
- `export_xml_well_formed`
