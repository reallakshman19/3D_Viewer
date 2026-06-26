# Source Tools shell-slot registration

Date: 2026-06-26
Scope: PR 3 Source Tools migration into the RVM UI shell.

## What changed

`RvmNonPrimitiveSourceToolsUiBridge.js` now prefers the shell-owned `source-tools` slot created by `RvmViewerUiShell.js`.

The bridge now:

- resolves the `source-tools` panel slot,
- registers itself as `nonprimitive-source-tools-ui`,
- marks hosted header and panel nodes with source-tools slot ownership,
- moves an already-created legacy panel into the shell slot when the shell appears later,
- activates the Source Tools right-panel tab when a source-preview model is active,
- keeps the original right-panel insertion fallback when the shell is unavailable.

## Why this is narrow

Only Source Tools is migrated in this PR. Node Marker and Support detail panels are intentionally left for later PRs so each migration can be reviewed and tested independently.

## Compatibility preserved

The panel ID remains unchanged:

- `#rvm-nonprimitive-source-tools-panel`

Existing controls remain unchanged:

- Auto Bend toggle
- Radius mode
- Bend diagnostics toggle
- InputXML vertical/north axis selectors
- Apply axis action
- Support symbol toggle
- Support label toggle
- Support scale
- Support filters
- Diagnostics copy/download

## Auditable contracts

`viewer/tests/nonprimitive-source-tools-ui.test.js` now verifies:

- v8 schema marker,
- shell slot selector,
- shell install/sync usage,
- shell registration API usage,
- source-tools tab activation,
- hosted panel markers,
- legacy panel migration into shell slot,
- updated deferred-loader cache key.

`viewer/tests/rvm-viewer-ui-contract.test.js` verifies the updated source-preview deferred cache key.

## Not included

- Node Marker shell registration.
- Support overlay/details shell registration.
- Interaction router work.
- XML-to-CII or InputXML-to-StagedJSON changes.
