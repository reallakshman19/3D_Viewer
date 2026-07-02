# Table to Categorized XML Review Checklist

## Scope checklist

- [ ] Canonical categorized graph remains the master model.
- [ ] XML remains one export format.
- [ ] Candidate/output rows are not treated as the master model.
- [ ] Single XML document root rule is preserved.
- [ ] Logical root partitions remain children of the document root.

## Runtime ownership checklist

- [ ] Table-to-Categorized popup has one runtime/state owner.
- [ ] Toolbar gate does not install Table-to-Categorized setup navigation.
- [ ] Runtime installation is idempotent.
- [ ] No duplicate document-level click/change/input handlers are registered for the builder.

## Engine correctness checklist

- [ ] `xmlTag` is authoritative for exported element names.
- [ ] XML output still has one document root.
- [ ] Logical partitions are nested below the document root.
- [ ] Unsupported creation modes produce BLOCKER diagnostics.
- [ ] `one-per-row` without `keyResolver` uses stable row identity.
- [ ] Duplicate headers preserve all values and produce diagnostics.
- [ ] Stable internal column IDs are available for duplicate headers.
- [ ] Delimiter override is supported.
- [ ] Auto delimiter detection still works.

## Guided shell checklist

- [ ] Table-to-Categorized UI has one visible 5-step flow.
- [ ] Default UI does not show competing workflow/setup/preview tab systems.
- [ ] One primary CTA appears per step.
- [ ] Right-side preview follows the active step.
- [ ] Existing parser/graph/export/canvas behavior is preserved.

## Progressive disclosure checklist

- [ ] One primary CTA is visible per step.
- [ ] Secondary/expert controls are inside inline disclosures.
- [ ] No separate Advanced tab/page exists.
- [ ] Default UI avoids internal implementation terms.
- [ ] Canvas and comparison actions remain explicit and user-triggered.

## Parser checklist

- [ ] Tab-delimited table is detected.
- [ ] Comma-delimited CSV is detected.
- [ ] Pipe-delimited table is detected.
- [ ] Semicolon-delimited table is supported by override.
- [ ] Whitespace-delimited table is detected reasonably.
- [ ] Raw headers are preserved.
- [ ] Raw cells are preserved.
- [ ] Duplicate headers preserve all values.
- [ ] Stable row references use `S1:1`, `S1:2`, `S1:3`.
- [ ] Delimiter used is reported.
- [ ] Delimiter override is reported.
- [ ] Inconsistent row column counts are reported.

## Non-mutation checklist

- [ ] SourceXML canvas is not mutated automatically.
- [ ] TargetXML canvas is not mutated automatically.
- [ ] Parser behavior changes are covered by tests.
- [ ] Graph builder behavior changes are covered by tests.
- [ ] XML exporter behavior changes are covered by tests.
- [ ] PS Mapping comparison behavior is not changed.
- [ ] PSNM integration is not introduced.
