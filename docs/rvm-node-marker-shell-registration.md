# Node Marker shell-slot registration

Date: 2026-06-26
Scope: PR 4 Node Marker details panel migration into the RVM UI shell.

## What changed

`RvmNonPrimitiveNodeMarkerDetailsPanelBridge.js` now prefers the shell-owned `node-markers` slot created by `RvmViewerUiShell.js`.

The details panel now:

- resolves the `node-markers` panel slot,
- registers itself as `nonprimitive-node-marker-details-panel`,
- marks hosted header and panel nodes with node-markers slot ownership,
- moves an already-created legacy panel into the shell slot when the shell appears later,
- activates the Node Markers right-panel tab only after a node marker glyph is selected,
- keeps the original right-panel insertion fallback when the shell is unavailable.

## Why this is narrow

Only the Node Marker details panel is migrated in this PR. Node Marker glyph creation, XML-CII table generation, overrides, stale checks, and Source Tools actions are not redesigned.

## Compatibility preserved

The panel ID remains unchanged:

- `#rvm-nonprimitive-node-marker-details-panel`

Existing behavior remains unchanged:

- node marker glyph picking,
- details JSON copy/download,
- override save/clear actions,
- no primitive RVM selection or object-search dependency.

## Cache chain

The source-preview deferred loader now records both:

- previous node marker cache key,
- active node marker shell-slot cache key.

This keeps the cache change auditable without hiding historical expectations used by existing guards.

## Not included

- Support overlay/details shell registration.
- Central interaction router work.
- XML-CII conversion logic changes.
- InputXML stagedJSON propagation changes.
