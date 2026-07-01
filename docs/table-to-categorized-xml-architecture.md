# Universal Table to Categorized XML Builder Architecture

## Purpose

The Universal Table to Categorized XML Builder imports arbitrary tabular sources and, in later phases, resolves them into a typed recursive categorized graph. The builder starts in XML Compare as a shadow-mode utility named **Table to Categorized XML**.

Phase 0-2 scope is intentionally limited to contracts, the shell entry point, source setup, source parsing, raw table preview, and diagnostics. It must not build graph nodes, generate XML, mutate SourceXML, mutate TargetXML, compare PS Mapping, or integrate PSNM.

## Core model rule

The canonical categorized graph is the future master model. XML is only one export format. Candidate rows, preview rows, output rows, resolver rows, and exported XML fragments must never become the master model.

The internal engine must not assume a fixed `Root -> Parent -> Child -> GrandChild` depth. `Parent`, `Child`, and `GrandChild` are UI labels only. The actual structure is recursive `LevelDefinition[]` producing recursive `GraphNode[]` relationships.

## Document root and logical partitions

Future XML exports must have a single XML document root. Logical splits are represented as root partitions below that document root, not as multiple XML roots.

The document root is single. Logical root partitions can split by file, zone, column, token, regex, or coordinate cluster.

Root behavior is static by default. Later profiles may declare dynamic logical root partitions, but the export must still validate `graph_has_single_document_root` before XML generation.

## Future contract names

Minimum Phase 0 contract names:

- `UniversalCategorizerProfile.v1`
- `ImportSource.v1`
- `ResolverPipeline.v1`
- `LevelDefinition.v1`
- `GraphNode.v1`
- `GraphEdge.v1`
- `CategorizerDiagnostic.v1`
- `CategorizedGraphExport.v1`

## Future internal model

### ImportSource[]

`ImportSource[]` stores raw imported sources. It preserves source identity, raw headers, raw cells, raw row references, parse diagnostics, and source-level metadata.

Minimum shape:

```js
{
  schema: 'ImportSource.v1',
  sourceId: 'S1',
  sourceName: 'Table 2 - Model PS Data',
  sourceType: 'pasteText',
  headers: ['PS NO', 'Bore', 'Support Gap'],
  rows: [
    {
      rowId: 'S1:1',
      rawCells: ['PS-01', '4', '5'],
      rawByHeader: {
        'PS NO': 'PS-01',
        Bore: '4',
        'Support Gap': '5'
      }
    }
  ],
  diagnostics: []
}
```

Raw source rows are evidence. They are not graph nodes and are not the master model.

### ResolverPipeline[]

`ResolverPipeline[]` declares how raw source evidence becomes typed resolver outputs. Display name, group key, object key, lookup key, and field values are separate resolver concepts.

Resolvers must not write directly to XML. They emit typed outputs for graph construction and diagnostics.

### LevelDefinition[]

`LevelDefinition[]` is recursive. Each level declares a level id, display label, key strategy, parent strategy, allowed child level definitions, and validation gates.

`Parent`, `Child`, and `GrandChild` labels may be shown in the UI, but the engine uses recursive `LevelDefinition[]` internally.

### GraphNode[]

`GraphNode[]` is the canonical categorized master model. Each node has a stable graph id, level id, parent id, display name, object key, group key, lookup keys, field values, source references, and diagnostics.

Graph nodes are not XML nodes. XML tag names and attributes are export-profile decisions.

### GraphEdge[]

`GraphEdge[]` declares typed relationships between graph nodes. Parent-child hierarchy is one edge type; future phases may add lookup, reference, evidence, or compare edges.

### Diagnostic[]

`Diagnostic[]` records parse, resolver, graph, validation, and export issues. Diagnostics must include severity, code, message, and stable source or graph references when available.

### ExportProfile[]

`ExportProfile[]` maps the canonical graph to output formats. XML export is one profile type only. Later JSON, table, compare, or canvas-handoff exports must still consume the graph, not candidate/output rows.

## Coordinate grouping contract for later phases

Coordinate grouping is not implemented in Phase 0-2. When implemented later, every coordinate grouping profile must declare:

- unit
- axis mapping
- rounding
- tolerance
- cluster method
- origin/datum
- coordinate source
- failure policy

Coordinate grouping must fail validation unless `coordinate_units_declared` and `coordinate_tolerance_declared` pass.

## Validation gates for future phases

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

## Phase 0-2 implementation boundary

Implemented now:

- shadow-mode shell entry near Line-wise XML Enrichment / Categorized XML
- Source Setup tab
- paste/file source import
- delimiter detection for tab, comma, pipe, and whitespace tables
- raw header, raw cell, and stable source row preservation
- raw preview table
- parse diagnostics

Explicitly not implemented now:

- resolver pipeline execution
- LevelDefinition designer logic
- graph generation
- GraphNode or GraphEdge creation
- XML export
- JSON export
- SourceXML or TargetXML canvas handoff
- PS Mapping compare
- PSNM matching
