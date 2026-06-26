# Supports shell-slot registration

Date: 2026-06-26
Scope: PR 5 Support details panel migration into the RVM UI shell.

## What changed

`RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js` now prefers the shell-owned `supports` slot created by `RvmViewerUiShell.js`.

The details panel now:

- resolves the `supports` panel slot,
- registers itself as `nonprimitive-support-details-panel`,
- marks hosted header and panel nodes with supports slot ownership,
- moves an already-created legacy panel into the shell slot when the shell appears later,
- activates the Supports right-panel tab only after a support glyph is selected,
- keeps the original right-panel insertion fallback when the shell is unavailable.

## Why this is narrow

Only the Support Details panel is migrated in this PR. Geometry, filtering, highlight logic, and export logic are not redesigned.

## Compatibility preserved

The panel ID remains unchanged:

- `#rvm-nonprimitive-support-details-panel`

Existing behavior remains unchanged:

- support glyph picking,
- details JSON copy/download,
- Escape-to-clear selection,
- support highlight state,
- primitive RVM selection remains excluded.

## Cache chain

The source-preview deferred loader now records both:

- previous support details cache key,
- active support details shell-slot cache key.

This keeps the cache change auditable while preserving historical guard strings.

## Not included

- Central interaction router work.
- Diagnostics/export pane consolidation.
- Converter logic changes.
- InputXML stagedJSON propagation changes.
