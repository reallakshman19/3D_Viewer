# XML Compare — Dynamic CategorizedInputXML Canvas Builder

This change adds a dynamic canvas model for `categorized-inputxml` sources.

## Purpose

When a categorized enriched InputXML file is selected in XML Compare, the Source or Target canvas can show semantic levels from the XML structure instead of a flat record list.

Detected levels:

- `lineBlock` — label: LineBlock
- `element` — label: Element
- `node` — label: Node
- `nodeEvidence` — label: Node Evidence

Legacy level IDs are mapped by the canvas model:

- `line` → `lineBlock`
- `evidence` → `nodeEvidence`

## Dynamic detection

The builder detects records from the loaded XML data:

- direct `Line` children below `CategorizedInputXML`
- real `Element` tags below each line
- real `Node` tags below each element
- direct node child evidence blocks such as `DerivedCoordinateBlock`, `TemperatureBlock`, `RestraintsBlock`, `DisplacementsBlock`, `ForcesMomentsBlock`, `SifBlock`, and any other direct node block

It does not hardcode line names such as `LINENO1` and does not hardcode BM_CII counts.

## CDATA rule

The lightweight XML parser treats CDATA as text. Tags inside `OriginalElement><![CDATA[...]]>` are not parsed as active `Element`, `Node`, or `PIPINGELEMENT` records.

## Layouts

The canvas level model chooses layouts based on detected level and count:

- LineBlock: `tiles` or `compact-list`
- Element: `grouped-tree` or `grouped-compact-tree`
- Node: `grouped-tree` or `grouped-compact-tree`
- Node Evidence: `grouped-compact-tree`

The graph canvas renderer keeps existing `cards` and `line-node` behavior and adds:

- `tiles`
- `compact-list`
- `grouped-tree`
- `grouped-compact-tree`

## Compatibility

Selectable records continue to include:

- `data-xml-compare-record-uid`
- `data-xml-compare-side`

The connector lane, manual connector state, PSNM, PS Mapping production utilities, SourceXML / TargetXML mutation logic, and Table-to-Categorized graph compare modules are not changed.
