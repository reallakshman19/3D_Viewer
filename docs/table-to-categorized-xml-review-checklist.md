# Table to Categorized XML Review Checklist

## Scope checklist

- [ ] Documentation exists for the universal typed recursive categorized graph builder.
- [ ] The implementation does not assume PS Mapping as the only source type.
- [ ] The implementation does not assume fixed Root / Parent / Child / GrandChild engine depth.
- [ ] Candidate/output rows are not treated as the master model.
- [ ] The canonical categorized graph is documented as the master model.
- [ ] XML is documented as only one export format.
- [ ] The future XML export rule uses one XML document root.
- [ ] Logical root partitions are documented as children of the document root.

## Runtime ownership checklist

- [ ] Table-to-Categorized popup has one runtime/state owner.
- [ ] Toolbar gate does not install Table-to-Categorized setup navigation.
- [ ] Runtime installation is idempotent.
- [ ] No duplicate document-level click/change/input handlers are registered for the builder.

## Guided shell checklist

- [ ] Table-to-Categorized UI has one visible 5-step flow.
- [ ] Default UI does not show competing workflow/setup/preview tab systems.
- [ ] One primary CTA appears per step.
- [ ] Right-side preview follows the active step.
- [ ] Existing parser/graph/export/canvas behavior is preserved.
- [ ] Runtime ownership guard from PR #707 remains intact.

## Progressive disclosure checklist

- [ ] One primary CTA is visible per step.
- [ ] Secondary/expert controls are inside inline disclosures.
- [ ] No separate Advanced tab/page exists.
- [ ] Default UI avoids internal implementation terms.
- [ ] Canvas and comparison actions remain explicit and user-triggered.
- [ ] Parser/graph/export/canvas behavior is unchanged.

## UI checklist

- [ ] `Table to Categorized XML` appears near `Line-wise XML Enrichment / Categorized XML`.
- [ ] Existing line-wise categorized XML workflow still opens and behaves as before.
- [ ] The shell opens and closes cleanly.
- [ ] The visible flow is `1 Table → 2 Columns → 3 Structure → 4 Preview → 5 Export`.
- [ ] Locked/not-ready steps explain what must happen first.
- [ ] Export / Link actions remain explicit and do not auto-mutate canvases.

## Source import checklist

- [ ] Paste textarea exists.
- [ ] Source name field exists.
- [ ] Parse button exists.
- [ ] Clear/reset button exists.
- [ ] Parsed source list is shown after parse.
- [ ] Raw preview table is shown after parse.
- [ ] Diagnostics panel is shown after parse.
- [ ] Empty input produces a controlled validation diagnostic.
- [ ] Inconsistent column count produces a warning and does not crash the UI.

## Parser checklist

- [ ] Tab-delimited table is detected.
- [ ] Comma-delimited CSV is detected.
- [ ] Pipe-delimited table is detected.
- [ ] Whitespace-delimited table is detected reasonably.
- [ ] Raw headers are preserved.
- [ ] Raw cells are preserved.
- [ ] Stable row references use `S1:1`, `S1:2`, `S1:3`.
- [ ] Header count is reported.
- [ ] Row count is reported.
- [ ] Delimiter used is reported.
- [ ] Blank rows skipped are reported.
- [ ] Inconsistent row column counts are reported.

## Non-mutation checklist

- [ ] SourceXML canvas is not mutated automatically.
- [ ] TargetXML canvas is not mutated automatically.
- [ ] Resolver pipeline behavior is not changed by the shell revamp.
- [ ] Graph builder behavior is not changed by the shell revamp.
- [ ] XML exporter behavior is not changed by the shell revamp.
- [ ] PS Mapping comparison behavior is not changed by the shell revamp.
- [ ] PSNM integration is not introduced.

## Validation gate checklist for future phases

- [ ] `source_parse_ok`
- [ ] `required_columns_present`
- [ ] `resolver_outputs_non_empty`
- [ ] `key_parts_non_empty`
- [ ] `key_uniqueness_per_parent`
- [ ] `display_name_resolved`
- [ ] `parent_link_resolved`
- [ ] `coordinate_units_declared`
- [ ] `coordinate_tolerance_declared`
- [ ] `multi_value_policy_declared`
- [ ] `duplicate_key_policy_declared`
- [ ] `xml_tag_valid`
- [ ] `xml_attribute_valid`
- [ ] `graph_has_single_document_root`
- [ ] `export_xml_well_formed`
